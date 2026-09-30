import { redirect } from 'next/navigation';
import { requireMenuAccess } from '@/lib/authorization';
import BillingDashboard from './BillingDashboard';

export default async function PrevisaoFaturamentoPage() {
  const access = await requireMenuAccess('previsao_faturamento');
  if (!access.ok) redirect(access.status === 401 ? '/login' : '/acesso-negado');
  return <BillingDashboard />;
}
