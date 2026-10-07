"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { readFinancialMetadata, refreshFinancialData } from "@/lib/clientSync";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientRefreshError = (error) => {
  const message = String(error?.message || '').toUpperCase();
  return message.includes('HTTP 502')
    || message.includes('HTTP 503')
    || message.includes('HTTP 504')
    || message.includes('TEMPORARIAMENTE INDISPONÍVEL')
    || message.includes('TEMPORARIAMENTE INDISPONIVEL');
};

export default function FinancialRefreshButton({
  onUpdated,
  onError,
  label = "Atualizar dados",
  className = "btn btn-primary",
}) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);

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
  }, [loadMetadata]);

  const isAdmin = Boolean(metadata?.canForceRefresh);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      let result = null;
      let lastError = null;
      const attempts = isAdmin ? 3 : 1;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          result = await refreshFinancialData({ manual: true });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (!isAdmin || !isTransientRefreshError(error) || attempt === attempts) break;
          await sleep(attempt === 1 ? 2000 : 5000);
        }
      }

      if (lastError) throw lastError;

      await loadMetadata();
      await onUpdated?.(result);
    } catch (error) {
      await loadMetadata();
      if (isAdmin) {
        onError?.(error?.message || "Não foi possível atualizar os dados.");
      } else {
        await onUpdated?.({ ok: true, skipped: true, refreshReason: "PRESERVED_SNAPSHOT" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleRefresh}
      disabled={loading}
      title="Atualizar dados"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.45rem",
        opacity: 1,
        cursor: loading ? "wait" : "pointer",
        alignSelf: "center",
      }}
    >
      <RefreshCw size={14} className={loading ? "spin" : ""}/>
      {loading ? "Atualizando..." : label}
    </button>
  );
}
