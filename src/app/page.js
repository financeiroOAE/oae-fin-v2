"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { readSession, readFinancialMetadata } from '@/lib/clientSync';

export default function Home() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    let active = true;

    async function initializePanel() {
      setIsSyncing(true);

      try {
        const sessionData = await readSession();
        if (active && sessionData?.user) {
          if (sessionData.user.username) setUserName(sessionData.user.username);
        }
      } catch {
        // O nome e opcional; uma falha nessa consulta nao deve bloquear o painel.
      }

      try {
        const result = await readFinancialMetadata();
        if (active && result?.syncedAt) {
          const time = new Date(result.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          setMessage(`Última base válida: ${time}.`);
        }
      } catch (err) {
        if (active) {
          setError(`${err.message} Os números anteriores permanecem preservados.`);
        }
      } finally {
        if (active) setIsSyncing(false);
      }
    }

    initializePanel();
    return () => { active = false; };
  }, []);

  return (
    <div className="home-dashboard" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
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

      <div className="fade-in home-dashboard-content" style={{ marginTop: '2rem' }}>
        <div className="home-welcome" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div className="home-brand-line">
            {!logoError ? (
              <img src="/logo.png" alt="Oliveira Araújo Engenharia" onError={() => setLogoError(true)} />
            ) : (
              <div className="home-logo-fallback">OAE</div>
            )}
            <span>PAINEL FINANCEIRO</span>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Bem-vindo{userName ? `, ${userName}` : ''}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSyncing ? 'Carregando o painel...' : 'Utilize o menu lateral para acessar as áreas do sistema.'}
          </p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
