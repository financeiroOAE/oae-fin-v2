"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, Clock3, History, Palette, RefreshCw, Shield, Settings } from 'lucide-react';
import UserAccessManager from '@/components/UserAccessManager';

const themeOptions = [
  { id: 'original', label: 'Original', description: 'Azul-marinho original OAE', swatches: ['#061b33', '#0d233d', '#39c6c6'] },
  { id: 'preto', label: 'Preto', description: 'Fundo escuro profundo', swatches: ['#07111f', '#0f1d2b', '#39c6c6'] },
  { id: 'cinza', label: 'Cinza', description: 'Fundo neutro intermediário', swatches: ['#2e3338', '#3a4046', '#39c6c6'] },
  { id: 'branco', label: 'Branco', description: 'Fundo claro e alto contraste', swatches: ['#f3f6f8', '#ffffff', '#138b8b'] },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('aparencia');
  const [theme, setTheme] = useState('preto');
  const [sessionUser, setSessionUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('oae_panel_theme');
    if (themeOptions.some((option) => option.id === saved)) Promise.resolve().then(() => setTheme(saved));
    fetch('/api/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => setSessionUser(result.user || null))
      .catch(() => setSessionUser(null));
  }, []);

  const applyTheme = (nextTheme) => {
    setTheme(nextTheme);
    localStorage.setItem('oae_panel_theme', nextTheme);
    requestAnimationFrame(() => document.documentElement.setAttribute('data-theme', nextTheme));
  };

  const isAdmin = sessionUser?.role === 'ADMIN';
  const sections = [
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'empresa', label: 'Perfil Corporativo', icon: Building2 },
    ...(isAdmin ? [{ id: 'acessos', label: 'Permissões e Acessos', icon: Shield }] : []),
  ];

  return (
    <div className="fade-in settings-page">
      <header className="settings-page-header">
        <div><h1>Configurações</h1><p>Preferências do painel, dados corporativos e controle de acesso.</p></div>
      </header>

      <div className="settings-layout">
        <aside className="settings-menu card">
          {sections.map((section) => {
            const Icon = section.icon;
            return <button key={section.id} type="button" className={activeSection === section.id ? 'is-active' : ''} onClick={() => setActiveSection(section.id)}><Icon size={17} /> {section.label}</button>;
          })}
          <div className="settings-menu-divider" />
          <Link href="/atualizacao-dados"><RefreshCw size={17} /> Atualização de Dados</Link>
          <Link href="/historico"><History size={17} /> Histórico</Link>
        </aside>

        <main className="settings-content card">
          {activeSection === 'aparencia' && (
            <section>
              <div className="settings-section-heading"><div><h2><Palette size={19} /> Tema do Painel</h2><p>Altere somente as cores. O layout, os tamanhos e a organização permanecem iguais.</p></div></div>
              <div className="theme-grid">
                {themeOptions.map((option) => (
                  <button key={option.id} type="button" className={`theme-option ${theme === option.id ? 'is-selected' : ''}`} onClick={() => applyTheme(option.id)}>
                    <span className="theme-preview">{option.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
                    <span className="theme-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                    <span className="theme-selected-mark">{theme === option.id && <Check size={15} />}</span>
                  </button>
                ))}
              </div>
              <div className="settings-info-row"><Settings size={17} /><div><strong>Preferência salva neste computador</strong><span>A cor escolhida é aplicada imediatamente e permanece no próximo acesso.</span></div></div>
            </section>
          )}

          {activeSection === 'empresa' && (
            <section>
              <div className="settings-section-heading"><div><h2><Building2 size={19} /> Dados da Empresa</h2><p>Identificação corporativa usada no painel e nos relatórios.</p></div></div>
              <div className="settings-form-grid">
                <label>Razão Social<input type="text" value="Oliveira Araújo Engenharia" disabled /></label>
                <label>Identificação do sistema<input type="text" value="OAE_FIN" disabled /></label>
              </div>
              <div className="settings-info-row"><Clock3 size={17} /><div><strong>Dados corporativos protegidos</strong><span>A edição ficará disponível quando o cadastro corporativo estiver conectado ao backend definitivo.</span></div></div>
            </section>
          )}

          {activeSection === 'acessos' && isAdmin && <UserAccessManager />}
        </main>
      </div>
      <p className="settings-version">v2.0.0 • OAE Financeiro</p>
    </div>
  );
}
