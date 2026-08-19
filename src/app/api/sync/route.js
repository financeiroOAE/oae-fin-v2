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

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.username) {
    return NextResponse.json({ error: 'Sessão não autenticada' }, { status: 401 });
  }

  const username = session.user.username;
  const force = new URL(request.url).searchParams.get('force') === '1';

  try {
    const snapshot = await readCurrentSnapshot();
    const scheduledDue = !force && isDailySyncDue(snapshot?.updatedAt);

    if (force || scheduledDue) {
      const triggeredBy = force ? username : 'AUTO_16:30';
      const payload = await refreshFinancialSnapshot(triggeredBy);

      return NextResponse.json({
        ...payload,
        fromSnapshot: false,
        refreshReason: force ? 'MANUAL' : 'AUTO_16:30',
      });
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
