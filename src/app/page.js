"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  BarChart3,
  ChevronRight,
  Activity,
  FolderKanban,
  ChartColumn,
  History,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    let active = true;

    async function initializePanel() {
      try {
        const res = await fetch('/api/session', { cache: 'no-store' });
        const sessionData = await res.json();
        if (!active || !sessionData?.user?.username) return;

        setUserName(sessionData.user.username);
        setIsSyncing(true);

        const syncRes = await fetch('/api/sync', { method: 'GET', cache: 'no-store' });
        const syncData = await syncRes.json();
        if (!syncRes.ok) {
          throw new Error(syncData.error || syncData.details?.message || 'Falha ao carregar os dados financeiros.');
        }
      } catch (err) {
        if (active) setError(err.message || 'Falha ao carregar os dados financeiros.');
      } finally {
        if (active) setIsSyncing(false);
      }
    }

    initializePanel();
    return () => { active = false; };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setMessage('');

    try {
      const response = await fetch('/api/sync?force=1', { method: 'GET', cache: 'no-store' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details?.message || 'Erro desconhecido');
      }
      setMessage('Dados atualizados. Todas as telas usarão os novos números.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {error && (
        <div className="fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.5rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
          <AlertCircle size={18} /> <strong>Falha:</strong> {error}
        </div>
      )}

      {message && (
        <div className="fade-in" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px' }}>
          <CheckCircle2 size={18} /> <strong>Sucesso:</strong> {message}
        </div>
      )}

      <div className="fade-in" style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          {!logoError ? (
            <img
              src="/logo.png"
              alt="Oliveira Araújo Engenharia"
              style={{ height: '56px', width: 'auto', objectFit: 'contain', margin: '0 auto 1.5rem auto', display: 'block' }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <div style={{ display: 'flex', width: '64px', height: '64px', margin: '0 auto 1.5rem auto', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', borderRadius: '12px', color: '#fff', fontWeight: '900', fontSize: '18px', letterSpacing: '1px' }}>
              OAE
            </div>
          )}

          <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Bem-vindo{userName ? `, ${userName}` : ''}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSyncing ? 'Carregando a base financeira da sessão...' : 'O que você deseja consultar hoje?'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', maxWidth: '1000px', margin: '0 auto' }}>
          {[
            { name: 'Visão Financeira', desc: 'Resumo consolidado e KPIs', icon: BarChart3, color: 'var(--primary)', onClick: () => router.push('/visao-financeira') },
            { name: 'Fluxo de Caixa', desc: 'Saldos bancários e evolução', icon: Activity, color: 'var(--success)', onClick: () => router.push('/fluxo-caixa') },
            { name: 'Projetos', desc: 'Contratos e curvas', icon: FolderKanban, color: 'var(--info)', onClick: () => router.push('/projetos') },
            { name: 'DRE Gerencial', desc: 'Demonstrativo de resultados', icon: ChartColumn, color: 'var(--purple)', onClick: () => router.push('/dre') },
            { name: 'Atualização de Dados', desc: 'Forçar nova leitura do Google Sheets', icon: RefreshCw, color: 'var(--orange)', onClick: handleSync },
            { name: 'Histórico', desc: 'Logs de sincronização', icon: History, color: 'var(--text-secondary)', onClick: () => router.push('/historico') },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="card shortcut-card" onClick={item.onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1.25rem', gap: '1rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={2} className={item.name === 'Atualização de Dados' && isSyncing ? "spinner" : ""} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.15rem' }}>{item.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
              </div>
            );
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .shortcut-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
