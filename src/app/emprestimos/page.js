import { redirect } from 'next/navigation';
import { getCurrentUser, normalizePermissions } from '@/lib/authorization';
import LoansDashboard from './LoansDashboard';

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && !normalizePermissions(user.menuPermissions).includes('emprestimos')) redirect('/acesso-negado');
  return <LoansDashboard />;
}
