"use client";

import { useState, useEffect } from "react";
import { History, AlertCircle, RefreshCw, CheckCircle, ServerCrash, Clock, User } from "lucide-react";

export default function Historico() {
  const [historico, setHistorico] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/history');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao buscar histórico');
      setHistorico(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Histórico
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Auditoria de execuções da sincronização
          </p>
        </div>
        <button onClick={fetchHistory} className="btn" disabled={isLoading} style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
          <RefreshCw size={14} className={isLoading ? "spin" : ""} /> Atualizar
        </button>
      </header>
      
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={16} /> Timeline de Atividades
        </h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto', marginBottom: '1rem' }} />
            <p>Carregando histórico...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <AlertCircle size={32} style={{ margin: '0 auto', marginBottom: '1rem' }} />
            <p style={{ fontWeight: '500' }}>Erro ao carregar histórico</p>
            <p style={{ fontSize: '13px', marginTop: '0.5rem', opacity: 0.8 }}>{error}</p>
          </div>
        ) : historico.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            <History size={48} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhum histórico encontrado</p>
            <p style={{ fontSize: '13px' }}>Ainda não existem registros persistidos de sincronização no sistema.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
            {historico.map((item, idx) => (
              <div key={item.id || idx} style={{ position: 'relative' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: '-30px', 
                  top: '2px', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: item.status === 'SUCCESS' ? 'var(--success)' : 'var(--danger)',
                  border: '2px solid var(--bg-elevated)'
                }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {item.status === 'SUCCESS' ? <CheckCircle size={14} color="var(--success)" /> : <ServerCrash size={14} color="var(--danger)" />}
                        Sincronização de Dados {item.status === 'SUCCESS' ? 'Concluída' : 'Falhou'}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Ação iniciada pelo usuário do sistema.
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      <Clock size={12} /> {formatDate(item.createdAt)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} /> {item.triggeredBy || 'Sistema'}
                    </span>
                    <span>•</span>
                    <span>{item.recordsCount || 0} registros processados</span>
                  </div>

                  {item.details && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <details>
                        <summary style={{ fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', outline: 'none' }}>Ver Detalhes das Abas</summary>
                        <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '11px', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.details}</pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
