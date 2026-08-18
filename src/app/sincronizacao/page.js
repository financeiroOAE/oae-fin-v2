"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SyncHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(result => {
        if (result.success) setHistory(result.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Atualização de Dados</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Histórico de sincronização com o Google Sheets</p>
        </div>
        <Link href="/" className="btn" style={{ border: '1px solid var(--border-color)', color: 'white', textDecoration: 'none' }}>
          Voltar ao Painel
        </Link>
      </header>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem' }}>Últimas Sincronizações</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Status</th>
                <th>Registros Totais</th>
                <th>Detalhes / Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{textAlign: 'center'}}>Carregando...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Nenhum histórico encontrado.</td></tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                    <td>{item.triggeredBy}</td>
                    <td>
                      <span className={`badge ${item.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.recordsCount || 0}</td>
                    <td style={{ color: item.status === 'ERROR' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {item.errorMessage || item.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
