"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { readFinancialMetadata, refreshFinancialData } from "@/lib/clientSync";

function remainingLabel(ms) {
  if (ms <= 0) return "";
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
}

export default function FinancialRefreshButton({
  onUpdated,
  onError,
  label = "Atualizar dados",
  className = "btn btn-primary",
  showStatus = true,
}) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadMetadata = useCallback(async () => {
    try {
      const result = await readFinancialMetadata();
      setMetadata(result);
      return result;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadMetadata();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [loadMetadata]);

  const nextAt = metadata?.nextManualRefreshAt
    ? new Date(metadata.nextManualRefreshAt).getTime()
    : 0;
  const blocked = Boolean(nextAt && nextAt > now);
  const remaining = useMemo(() => remainingLabel(nextAt - now), [nextAt, now]);

  const handleRefresh = async () => {
    if (loading || blocked) return;
    setLoading(true);
    try {
      const result = await refreshFinancialData({ manual: true });
      await loadMetadata();
      await onUpdated?.(result);
    } catch (error) {
      await loadMetadata();
      onError?.(error?.message || "Não foi possível atualizar os dados.");
    } finally {
      setLoading(false);
    }
  };

  const lastSync = metadata?.syncedAt
    ? new Date(metadata.syncedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;
  const nextTime = blocked
    ? new Date(nextAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
      <button
        type="button"
        className={className}
        onClick={handleRefresh}
        disabled={loading || blocked}
        title={blocked ? `Atualização liberada às ${nextTime}. Intervalo mínimo de 2 horas.` : "Atualizar a base financeira agora"}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", opacity: blocked ? 0.62 : 1, cursor: loading || blocked ? "not-allowed" : "pointer" }}
      >
        {blocked ? <Clock3 size={14}/> : <RefreshCw size={14} className={loading ? "spin" : ""}/>}
        {loading ? "Atualizando..." : blocked ? `Atualizar em ${remaining}` : label}
      </button>
      {showStatus && (
        <small style={{ fontSize: "9px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {blocked ? `Nova atualização às ${nextTime}` : lastSync ? `Última base: ${lastSync}` : "Atualização manual a cada 2h"}
        </small>
      )}
    </div>
  );
}
