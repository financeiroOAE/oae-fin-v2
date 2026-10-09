"use client";

import { useEffect, useRef } from "react";

const EVENT = "oae-fin:financial-snapshot-updated";

// Atualiza os dados da aba atual sem redefinir filtros, páginas ou seleção.
// A função recebida deve ler o snapshot, e jamais disparar outro full-sync.
export default function useFinancialSnapshotUpdate(reloadSnapshot) {
  const callback = useRef(reloadSnapshot);
  useEffect(() => { callback.current = reloadSnapshot; }, [reloadSnapshot]);

  useEffect(() => {
    let active = true;
    let running = false;
    const handleUpdate = () => {
      if (!active || running) return;
      running = true;
      Promise.resolve().then(() => callback.current?.()).catch((error) => {
        console.warn("[financial-snapshot] Não foi possível carregar a nova versão", error);
      }).finally(() => { running = false; });
    };
    window.addEventListener(EVENT, handleUpdate);
    return () => {
      active = false;
      window.removeEventListener(EVENT, handleUpdate);
    };
  }, []);
}
