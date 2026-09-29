import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  readCurrentSnapshot,
  refreshFinancialSnapshot,
  registerSyncError,
} from '@/lib/financialSync';

const SYNC_TIMEOUT_MS = 30000;

async function withTimeout(promise, timeoutMs = SYNC_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('O Google Sheets não respondeu dentro de 30 segundos. Tente novamente.');
      error.code = 'SYNC_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.username) {
    return NextResponse.json({ error: 'Sessão não autenticada' }, { status: 401 });
  }

  const username = session.user.username;

  const visiblePayload = (payload) => payload;
  let snapshot = null;

  try {
    // Route handlers do Next recebem NextRequest; usar nextUrl evita reconstruir/parsing manual da URL.
    const force = request.nextUrl?.searchParams?.get('force') === '1';
    const refreshOnly = request.nextUrl?.searchParams?.get('refresh') === '1';
    const snapshotOnly = request.nextUrl?.searchParams?.get('snapshot') === '1';

    snapshot = await readCurrentSnapshot();

    if (snapshotOnly) {
      if (!snapshot?.payload) {
        return NextResponse.json(
          { error: 'Ainda não existe uma base financeira sincronizada.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...visiblePayload(snapshot.payload),
        fromSnapshot: true,
        snapshotAt: snapshot.updatedAt,
        snapshotUpdatedBy: snapshot.updatedBy,
      });
    }

    const requestedRefresh = force || refreshOnly;

    if (requestedRefresh) {
      try {
        const payload = await withTimeout(refreshFinancialSnapshot(username));

        if (refreshOnly) {
          return NextResponse.json({
            ok: true,
            syncedAt: payload.syncedAt,
            recordsCount: payload.recordsCount,
            refreshReason: 'MANUAL',
          });
        }

        return NextResponse.json({
          ...visiblePayload(payload),
          fromSnapshot: false,
          refreshReason: 'MANUAL',
        });
      } catch (refreshError) {
        await registerSyncError(username, refreshError);

        if (snapshot?.payload) {
          if (refreshOnly) {
            return NextResponse.json(
              {
                ok: false,
                error: 'A atualização não foi concluída; os números anteriores foram preservados.',
                fromSnapshot: true,
                snapshotAt: snapshot.updatedAt,
                refreshFailed: true,
              },
              { status: 502 }
            );
          }

          return NextResponse.json(
            {
              ...visiblePayload(snapshot.payload),
              error: 'A atualização não foi concluída; os números anteriores foram preservados.',
              fromSnapshot: true,
              snapshotAt: snapshot.updatedAt,
              snapshotUpdatedBy: snapshot.updatedBy,
              refreshFailed: true,
              refreshError: refreshError?.message || 'Falha ao atualizar dados',
            },
            { status: 502 }
          );
        }

        throw refreshError;
      }
    }

    if (!snapshot?.payload) {
      return NextResponse.json(
        { error: 'Ainda não existe uma base financeira sincronizada. Clique em Sincronizar Dados.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...visiblePayload(snapshot.payload),
      fromSnapshot: true,
      snapshotAt: snapshot.updatedAt,
      snapshotUpdatedBy: snapshot.updatedBy,
    });
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
