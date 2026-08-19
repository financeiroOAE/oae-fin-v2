"use client";

import { useEffect } from 'react';

const TIME_ZONE = 'America/Sao_Paulo';
const STORAGE_KEY = 'oae_fin_auto_sync_checked_day';

function getSaoPauloClock() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    dayKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export default function DailySyncScheduler() {
  useEffect(() => {
    let running = false;

    const checkDailySync = async () => {
      if (running) return;

      const clock = getSaoPauloClock();
      const reachedSchedule =
        clock.hour > 16 || (clock.hour === 16 && clock.minute >= 30);

      if (!reachedSchedule) return;
      if (localStorage.getItem(STORAGE_KEY) === clock.dayKey) return;

      running = true;
      try {
        const response = await fetch('/api/sync', {
          method: 'GET',
          cache: 'no-store',
        });

        if (response.ok) {
          localStorage.setItem(STORAGE_KEY, clock.dayKey);
          window.dispatchEvent(new CustomEvent('oae-fin-snapshot-updated'));
        }
      } catch {
        // A próxima verificação tenta novamente sem interromper a navegação.
      } finally {
        running = false;
      }
    };

    checkDailySync();
    const interval = window.setInterval(checkDailySync, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return null;
}
