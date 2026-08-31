import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  readCurrentSnapshot,
  refreshFinancialSnapshot,
  registerSyncError,
} from '@/lib/financialSync';

const TIME_ZONE = 'America/Sao_Paulo';
const SCHEDULE_HOUR = 16;
const SCHEDULE_MINUTE = 30;
const CASH_LOGIC_VERSION = 7;

function getZonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function isDailySyncDue(snapshotUpdatedAt) {
  if (!snapshotUpdatedAt) return true;

  const now = getZonedParts(new Date());
  const reachedSchedule =
    now.hour > SCHEDULE_HOUR ||
    (now.hour === SCHEDULE_HOUR && now.minute >= SCHEDULE_MINUTE);

  if (!reachedSchedule) return false;

  const snapshot = getZonedParts(new Date(snapshotUpdatedAt));
  const sameLocalDay =
    snapshot.year === now.year &&
    snapshot.month === now.month &&
    snapshot.day === now.day;

  if (!sameLocalDay) return true;

  return (
    snapshot.hour < SCHEDULE_HOUR ||
    (snapshot.hour === SCHEDULE_HOUR && snapshot.minute < SCHEDULE_MINUTE)
  );
}

function snapshotNeedsProjectRepair(payload) {
  if (!Array.isArray(payload?.projetos)) return true;
  if (payload.projetos.some((project) => project?.FATURADO_2026 === undefined || project?.FATURADO_2026 === null)) return true;
  if (!Array.isArray(payload?.data)) return false;
  return payload.data.some((item) => {
    if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return false;
    const project = String(item?.projeto || '').trim().toUpperCase();
    return project === 'GRUPO OAE';
  });
}

function snapshotNeedsCashRepair(payload) {
  if (!Array.isArray(payload?.data)) return false;
  if (payload.cashLogicVersion !== CASH_LOGIC_VERSION) return true;
  if (payload.recebimentosLiquidosStats?.source !== 'CR_GERAL_K_VALOR') return true;

  return payload.data.some((item) => {
    if (String(item?.natureza || '').toUpperCase() !== 'ENTRADA') return false;
    return item?.valorCaixa === undefined
      || item?.valorCaixa === null
      || !Number.isFinite(Number(item.valorCaixa))
      || item?.valorFaturamento === undefined
      || item?.valorFaturamento === null
      || item?.recebimentoLiquidoFonte !== 'CR_GERAL_K_VALOR';
  });
}

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.username) {
    return NextResponse.json({ error: 'Sessão não autenticada' }, { status: 401 });
  }

  const username = session.user.username;
  let snapshot = null;

  try {
    // Route handlers do Next recebem NextRequest; usar nextUrl evita reconstruir/parsing manual da URL.
    const force = request.nextUrl?.searchParams?.get('force') === '1';

    snapshot = await readCurrentSnapshot();
    const requiresProjectRepair = snapshotNeedsProjectRepair(snapshot?.payload);
    const requiresCashRepair = snapshotNeedsCashRepair(snapshot?.payload);
    const requiresRepair = requiresProjectRepair || requiresCashRepair;
    const scheduledDue = !force && !requiresRepair && isDailySyncDue(snapshot?.updatedAt);

    if (force || requiresRepair || scheduledDue) {
      const triggeredBy = force ? username : requiresCashRepair ? 'AUTO_REPAIR_CASH_V7' : requiresProjectRepair ? 'AUTO_REPAIR_PROJECTS' : 'AUTO_16:30';

      try {
        const payload = await refreshFinancialSnapshot(triggeredBy);
        return NextResponse.json({
          ...payload,
          fromSnapshot: false,
          refreshReason: force ? 'MANUAL' : requiresRepair ? 'SNAPSHOT_REPAIR' : 'AUTO_16:30',
        });
      } catch (refreshError) {
        await registerSyncError(triggeredBy, refreshError);

        if (snapshot?.payload) {
          return NextResponse.json({
            ...snapshot.payload,
            fromSnapshot: true,
            snapshotAt: snapshot.updatedAt,
            snapshotUpdatedBy: snapshot.updatedBy,
            refreshFailed: true,
            refreshError: refreshError?.message || 'Falha ao atualizar dados',
          });
        }

        throw refreshError;
      }
    }

    if (!snapshot) {
      const payload = await refreshFinancialSnapshot('INITIAL_BOOTSTRAP');
      return NextResponse.json({
        ...payload,
        fromSnapshot: false,
        refreshReason: 'INITIAL_BOOTSTRAP',
      });
    }

    return NextResponse.json({
      ...snapshot.payload,
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
