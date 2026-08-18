"use client";

import { Settings, Shield, RefreshCw, Link, Moon, Check } from "lucide-react";
import SettingsPage from "@/components/SettingsPage";

function LegacyConfiguracoes() {
  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Configurações
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Gerenciamento de preferências do sistema e dados corporativos
          </p>
        </div>
      </header>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Menu Lateral de Configurações */}
        <div style={{ flex: '1 1 250px' }}>
          <div className="card" style={{ padding: '0.5rem 0' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', fontWeight: '500' }}>
              <li style={{ padding: '0.85rem 1.25rem', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--primary)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Settings size={16} /> Perfil Corporativo
              </li>
              <li style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '3px solid transparent' }}>
                <Shield size={16} /> Permissões e Acessos
              </li>
              <li style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '3px solid transparent' }}>
                <RefreshCw size={16} /> Sincronização Avançada
              </li>
              <li style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '3px solid transparent' }}>
                <Link size={16} /> Integração Sienge
              </li>
            </ul>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div style={{ flex: '3 1 500px' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} /> Dados da Empresa
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Razão Social</label>
                <input type="text" value="Oliveira Araújo Engenharia" disabled style={{ width: '100%', height: '40px', fontSize: '13px', paddingLeft: '1rem', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>CNPJ Base</label>
                <input type="text" value="XX.XXX.XXX/0001-XX" disabled style={{ width: '100%', height: '40px', fontSize: '13px', paddingLeft: '1rem', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '2rem 0' }} />

            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Moon size={18} /> Preferências de Interface
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '13px', color: 'var(--text-main)', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} color="#fff" />
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Premium Dark Theme</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>O tema escuro é obrigatório nesta versão do painel financeiro.</span>
              </div>
            </div>
            
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>Cancelar</button>
              <button className="btn btn-primary" style={{ opacity: 0.7, cursor: 'not-allowed' }}>Salvar Alterações</button>
            </div>
          </div>
        </div>
      </div>
      
      <p style={{ fontSize: '12px', marginTop: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>v2.0.0 - OAE Frontend</p>
    </div>
  );
}

void LegacyConfiguracoes;
export default SettingsPage;
