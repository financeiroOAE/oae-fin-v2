"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Database, CheckCircle, AlertTriangle, Clock, ServerCrash, CheckSquare } from "lucide-react";

export default function AtualizacaoDados() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [duration, setDuration] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const fetchDados = async () => {
    setIsSyncing(true);
    setStatusMsg("Conectando ao Google Sheets e processando dados...");
    setErrorMsg(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/sync');
      const result = await response.json();
      
      const endTime = performance.now();
      setDuration(((endTime - startTime) / 1000).toFixed(2));

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Falha ao conectar ou processar os dados.');
      }
      
      setStats(result.stats || null);
      setLastSync(new Date().toLocaleString('pt-BR'));
      setStatusMsg(`Sincronização concluída com sucesso! Total de ${result.recordsCount || (result.stats ? Object.values(result.stats).reduce((a,b)=>a+b,0) : 0)} registros processados.`);
    } catch (err) {
      setErrorMsg("Ocorreu um erro durante a atualização dos dados.");
      setErrorDetails(err.message);
      setStatusMsg(null);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Apenas carrega os dados passivamente caso já estejam em cache na API
    // Se a API for lenta, não forçar a carga passiva bloquear.
  }, []);

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Atualização de Dados
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Operação de sincronização com o banco de dados oficial no Google Sheets
          </p>
        </div>
        <button onClick={fetchDados} className="btn btn-primary" disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', padding: '0.75rem 1.5rem' }}>
          <RefreshCw size={16} className={isSyncing ? "spin" : ""} /> {isSyncing ? 'Atualizando Dados...' : 'Atualizar Dados'}
        </button>
      </header>
      
      {/* Resumo da Operação */}
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} /> Status da Conexão
            </h2>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: errorMsg ? 'var(--danger)' : 'var(--success)' }}></div>
                {errorMsg ? 'Google Sheets Desconectado/Erro' : 'Google Sheets Conectado'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} /> Última Sincronização: {lastSync || 'Pendente'}
              </div>
              {duration && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={14} /> Duração: {duration}s
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {isSyncing && (
          <div style={{ padding: '1rem', background: 'rgba(57, 198, 198, 0.1)', border: '1px solid var(--primary)', borderRadius: '6px', color: 'var(--primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RefreshCw size={16} className="spin" /> {statusMsg}
          </div>
        )}

        {statusMsg && !isSyncing && !errorMsg && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '6px', color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={16} /> {statusMsg}
          </div>
        )}

        {errorMsg && !isSyncing && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600' }}>
              <ServerCrash size={16} /> {errorMsg}
            </div>
            <button 
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              style={{ background: 'transparent', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: '12px', marginTop: '0.5rem' }}
            >
              {showErrorDetails ? 'Ocultar Detalhes Técnicos' : 'Mostrar Detalhes Técnicos'}
            </button>
            {showErrorDetails && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {errorDetails}
              </div>
            )}
          </div>
        )}

        {/* Abas Sincronizadas */}
        {stats && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem' }}>Abas Processadas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {Object.entries(stats).map(([aba, count]) => (
                <div key={aba} style={{ padding: '1.25rem', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>{aba}</p>
                  <p style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-main)' }}>{count} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400' }}>registros</span></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
