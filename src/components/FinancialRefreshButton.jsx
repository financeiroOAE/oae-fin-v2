"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { readFinancialMetadata, refreshFinancialData } from "@/lib/clientSync";

export default function FinancialRefreshButton({
  onUpdated,
  onError,
  label = "Atualizar dados",
  className = "btn btn-primary",
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

  return (
    <button
      type="button"
      className={className}
      onClick={handleRefresh}
      disabled={loading || blocked}
      title={blocked ? "Atualização temporariamente bloqueada pelo intervalo de segurança." : "Atualizar a base financeira agora"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.45rem",
        opacity: blocked ? 0.62 : 1,
        cursor: loading || blocked ? "not-allowed" : "pointer",
        alignSelf: "center",
      }}
    >
      <RefreshCw size={14} className={loading ? "spin" : ""}/>
      {loading ? "Atualizando..." : label}
    </button>
  );
}
