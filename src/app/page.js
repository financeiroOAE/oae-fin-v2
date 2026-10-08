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
  CheckCircle2,
  UsersRound,
  UserRoundCheck
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { readSession, readFinancialMetadata, refreshFinancialData } from '@/lib/clientSync';

export default function Home() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [userName, setUserName] = useState('');
  const [sessionUser, setSessionUser] = useState(null);
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
          setSessionUser(sessionData.user);
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

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setMessage('');

    try {
      const result = await refreshFinancialData({ manual: true });
      const time = result.syncedAt ? new Date(result.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'agora';
      setMessage(`Base atualizada em ${time}. ${result.recordsCount || 0} registros processados; abra novamente as telas para ver os novos números.`);
    } catch (err) {
      setError(`${err.message} Os números anteriores continuam disponíveis. Confira o Histórico de sincronização.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const restrictedManagementMenus = ['equipe_gestao', 'administrativo_geral', 'administrativo_diretoria'];
  const canAccess = (permission) => restrictedManagementMenus.includes(permission)
    ? Boolean(sessionUser && (sessionUser.role === 'ADMIN' || sessionUser.permissions?.includes(permission)))
    : !sessionUser || sessionUser.role === 'ADMIN' || sessionUser.permissions?.includes(permission);
  const canViewAdministrativeGeneral = canAccess('administrativo_geral');

  const homeModules = [
    { name: 'Visão Financeira', desc: 'Resumo consolidado e KPIs', icon: BarChart3, color: 'var(--primary)', path: '/visao-financeira', permission: 'visao_financeira' },
    { name: 'Fluxo de Caixa', desc: 'Saldos bancários e evolução', icon: Activity, color: 'var(--success)', path: '/fluxo-caixa', permission: 'fluxo_caixa' },
    { name: 'Projetos', desc: 'Contratos e curvas', icon: FolderKanban, color: 'var(--info)', path: '/projetos', permission: 'projetos' },
    { name: 'Equipe', desc: 'Cadastro, pagamentos e custos por obra', icon: UsersRound, color: 'var(--primary)', path: '/equipe', permission: 'equipe_gestao' },
    {
      name: canViewAdministrativeGeneral ? 'Administrativo' : 'Diretora',
      desc: canViewAdministrativeGeneral ? 'Receitas, custos e movimentações administrativas' : 'Movimentações financeiras da diretoria',
      icon: UserRoundCheck,
      color: 'var(--warning)',
      path: canViewAdministrativeGeneral ? '/administrativo' : '/administrativo/socios',
      permission: canViewAdministrativeGeneral ? 'administrativo_geral' : 'administrativo_diretoria',
    },
    { name: 'DRE Gerencial', desc: 'Demonstrativo de resultados', icon: ChartColumn, color: 'var(--purple)', path: '/dre', permission: 'dre' },
    { name: 'Atualização de Dados', desc: 'Atualização controlada da base financeira', icon: RefreshCw, color: 'var(--orange)', path: '/atualizacao-dados', permission: 'atualizacao_dados' },
    { name: 'Histórico', desc: 'Logs de sincronização', icon: History, color: 'var(--text-secondary)', path: '/historico', permission: 'historico' },
  ].filter((item) => canAccess(item.permission));

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
            {isSyncing ? 'Carregando o painel...' : 'O que você deseja consultar hoje?'}
          </p>
        </div>

        <div className="home-shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', maxWidth: '1000px', margin: '0 auto' }}>
          {homeModules.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" key={item.path} className="card shortcut-card" onClick={() => router.push(item.path)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1.25rem', gap: '1rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', width: '100%', font: 'inherit', textAlign: 'left', color: 'inherit' }}>
                <div className="shortcut-icon" style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={2} className={item.name === 'Atualização de Dados' && isSyncing ? "spinner" : ""} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.15rem' }}>{item.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
              </button>
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
