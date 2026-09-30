import { redirect } from 'next/navigation';
import { requireMenuAccess } from '@/lib/authorization';
import DirectorsDashboard from './DirectorsDashboard';

export default async function DirectorsPage() {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) redirect(access.status === 401 ? '/login' : '/acesso-negado');
  return <DirectorsDashboard isAdmin={access.user.role === 'ADMIN'} />;
}
