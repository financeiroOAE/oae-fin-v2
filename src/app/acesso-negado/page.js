import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AcessoNegado() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: 'min(520px, 100%)', padding: '2rem', textAlign: 'center' }}>
        <ShieldAlert size={42} color="var(--warning)" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '22px', marginBottom: '0.5rem' }}>Acesso não liberado</h1>
        <p style={{ fontSize: '13px', marginBottom: '1.25rem' }}>Seu usuário não possui permissão para visualizar este menu. Solicite a liberação ao administrador.</p>
        <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>Voltar ao painel</Link>
      </div>
    </div>
  );
}
