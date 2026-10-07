import { redirect } from 'next/navigation';
import { requireMenuAccess } from '@/lib/authorization';
import AdministrativeDashboard from '../AdministrativeDashboard';

export default async function AdministrativePartnersPage() {
  const access = await requireMenuAccess('administrativo');
  if (!access.ok) redirect(access.status === 401 ? '/login' : '/acesso-negado');
  return <AdministrativeDashboard view="socios" />;
}
