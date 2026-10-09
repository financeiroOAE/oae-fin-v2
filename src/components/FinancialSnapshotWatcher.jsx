"use client";

import { useEffect, useRef } from "react";
import { readFinancialMetadata } from "@/lib/clientSync";

// A nova base já está armazenada no servidor; nunca dispara sincronização
// pesada do Google Sheets. Somente observa a versão salva a cada minuto.
export const SNAPSHOT_UPDATED_EVENT = "oae-fin:financial-snapshot-updated";

export default function FinancialSnapshotWatcher({ enabled = true }) {
  const lastVersionRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let checking = false;

    const checkSnapshot = async () => {
      if (!active || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const meta = await readFinancialMetadata();
        if (!active || !meta?.syncedAt) return;
        const previous = lastVersionRef.current;
        const next = String(meta.syncedAt);
        lastVersionRef.current = next;
        if (previous && previous !== next) {
          window.dispatchEvent(new CustomEvent(SNAPSHOT_UPDATED_EVENT, {
            detail: { syncedAt: next, previousSyncedAt: previous }
          }));
        }
      } catch {
        // Falhas transitórias do Render não substituem os números válidos.
        // A próxima verificação reutiliza a última versão conhecida.
      } finally {
        checking = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkSnapshot();
    };
    const id = window.setInterval(checkSnapshot, 60_000);
    window.addEventListener("focus", checkSnapshot);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void checkSnapshot();

    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener("focus", checkSnapshot);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  return null;
}
