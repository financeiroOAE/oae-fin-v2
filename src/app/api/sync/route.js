import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  readCurrentSnapshotMetadata,
  readCurrentSnapshotRecord,
  refreshFinancialSnapshot,
  registerSyncError,
} from '@/lib/financialSync';

const REFRESH_COOLDOWN_MS = 15000;
const MANUAL_REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
};

function snapshotResponse(snapshot) {
  return new Response(snapshot.payload, { status: 200, headers: JSON_HEADERS });
}

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.username) {
    return NextResponse.json({ error: 'Sessão não autenticada' }, { status: 401 });
  }

  const username = session.user.username;

  try {
    // Route handlers do Next recebem NextRequest; usar nextUrl evita reconstruir/parsing manual da URL.
    const force = request.nextUrl?.searchParams?.get('force') === '1';
    const refreshOnly = request.nextUrl?.searchParams?.get('refresh') === '1';
    const manual = request.nextUrl?.searchParams?.get('manual') === '1';
    const metadataOnly = request.nextUrl?.searchParams?.get('metadata') === '1';

    if (metadataOnly) {
      const metadata = await readCurrentSnapshotMetadata();
      const syncedAtMs = metadata?.updatedAt ? new Date(metadata.updatedAt).getTime() : 0;
      const nextManualRefreshAtMs = syncedAtMs ? syncedAtMs + MANUAL_REFRESH_COOLDOWN_MS : 0;
      const canManualRefresh = !nextManualRefreshAtMs || Date.now() >= nextManualRefreshAtMs;
      return NextResponse.json({
        ok: Boolean(metadata),
        syncedAt: metadata?.updatedAt?.toISOString?.() || null,
        updatedBy: metadata?.username || null,
        canManualRefresh,
        nextManualRefreshAt: nextManualRefreshAtMs ? new Date(nextManualRefreshAtMs).toISOString() : null,
        manualCooldownMinutes: MANUAL_REFRESH_COOLDOWN_MS / 60000,
      }, { headers: JSON_HEADERS });
    }

    const requestedRefresh = force || refreshOnly;

    if (requestedRefresh) {
      try {
        const metadata = await readCurrentSnapshotMetadata();
        const snapshotAge = metadata?.updatedAt
          ? Date.now() - new Date(metadata.updatedAt).getTime()
          : Number.POSITIVE_INFINITY;

        if (manual && snapshotAge < MANUAL_REFRESH_COOLDOWN_MS) {
          const nextManualRefreshAt = new Date(new Date(metadata.updatedAt).getTime() + MANUAL_REFRESH_COOLDOWN_MS);
          return NextResponse.json({
            ok: false,
            error: `Atualização bloqueada por segurança. Uma nova sincronização manual estará disponível às ${nextManualRefreshAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}.`,
            code: 'MANUAL_REFRESH_COOLDOWN',
            syncedAt: metadata.updatedAt.toISOString(),
            nextManualRefreshAt: nextManualRefreshAt.toISOString(),
            manualCooldownMinutes: MANUAL_REFRESH_COOLDOWN_MS / 60000,
          }, { status: 429, headers: JSON_HEADERS });
        }

        // Coalesce chamadas automáticas quase simultâneas.
        if (!manual) {
          if (snapshotAge < REFRESH_COOLDOWN_MS) {
            return NextResponse.json({
              ok: true,
              syncedAt: metadata.updatedAt.toISOString(),
              skipped: true,
              refreshReason: 'RECENT_SNAPSHOT',
            }, { headers: JSON_HEADERS });
          }
        }

        // Não usamos Promise.race como timeout: ele devolvia erro ao navegador,
        // mas deixava o processamento pesado vivo no servidor, acumulando memória.
        const payload = await refreshFinancialSnapshot(username);

        if (refreshOnly) {
          return NextResponse.json({
            ok: true,
            syncedAt: payload.syncedAt,
            recordsCount: payload.recordsCount,
            refreshReason: manual ? 'MANUAL' : 'REQUESTED',
          }, { headers: JSON_HEADERS });
        }

        const refreshedSnapshot = await readCurrentSnapshotRecord();
        if (!refreshedSnapshot) {
          throw new Error('A base foi processada, mas o snapshot não pôde ser lido.');
        }
        return snapshotResponse(refreshedSnapshot);
      } catch (refreshError) {
        await registerSyncError(username, refreshError);
        return NextResponse.json(
          {
            ok: false,
            error: 'A atualização não foi concluída; os números anteriores foram preservados.',
            refreshFailed: true,
            refreshError: refreshError?.message || 'Falha ao atualizar dados',
          },
          { status: 502 }
        );
      }
    }

    // Na atualização não carregamos o JSON anterior (potencialmente grande)
    // junto com a leitura e o processamento da planilha.
    const snapshot = await readCurrentSnapshotRecord();

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Ainda não existe uma base financeira sincronizada. Clique em Sincronizar Dados.' },
        { status: 404 }
      );
    }

    return snapshotResponse(snapshot);
  } catch (error) {
    const erroTecnico = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      apiMessage: error.response?.data?.error?.message,
    };

    console.error(
      'Erro Técnico na Sincronização:',
      JSON.stringify(erroTecnico, null, 2)
    );

    await registerSyncError(username, error);

    return NextResponse.json(
      {
        error: 'Falha ao sincronizar com o Google Sheets',
        details: erroTecnico,
      },
      { status: 500 }
    );
  }
}
