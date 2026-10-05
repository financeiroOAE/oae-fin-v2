import { redirect } from 'next/navigation';
import { requireMenuAccess } from '@/lib/authorization';
import TeamDashboard from './TeamDashboard';

export default async function TeamPage() {
  const access = await requireMenuAccess('equipe_gestao');
  if (!access.ok) redirect(access.status === 401 ? '/login' : '/acesso-negado');
  return <TeamDashboard />;
}
