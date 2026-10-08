import { redirect } from 'next/navigation';
import { requireMenuAccess } from '@/lib/authorization';
import AdministrativeDashboard from './AdministrativeDashboard';

export default async function AdministrativePage() {
  const access = await requireMenuAccess('administrativo_geral');
  if (!access.ok) redirect(access.status === 401 ? '/login' : '/acesso-negado');
  return <AdministrativeDashboard />;
}
