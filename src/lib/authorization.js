import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const MENU_DEFINITIONS = [
  { key: 'inicio', label: 'Início', path: '/' },
  { key: 'visao_financeira', label: 'Visão Financeira', path: '/visao-financeira' },
  { key: 'fluxo_caixa', label: 'Fluxo de Caixa', path: '/fluxo-caixa' },
  { key: 'projetos', label: 'Projetos', path: '/projetos' },
  { key: 'equipe_gestao', label: 'Equipe', path: '/equipe' },
  { key: 'administrativo', label: 'Administrativo', path: '/administrativo' },
  { key: 'dre', label: 'DRE Gerencial', path: '/dre' },
  { key: 'configuracoes', label: 'Configurações', path: '/configuracoes' },
  { key: 'atualizacao_dados', label: 'Atualização de Dados', path: '/atualizacao-dados' },
  { key: 'historico', label: 'Histórico', path: '/historico' },
];

const allowedPermissionKeys = new Set(MENU_DEFINITIONS.map((item) => item.key));

export function normalizePermissions(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((permission) => allowedPermissionKeys.has(permission)))];
}

export function serializePermissions(value) {
  return JSON.stringify(normalizePermissions(value));
}

export function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || '',
    role: user.role,
    permissions: normalizePermissions(user.menuPermissions),
    isActive: user.isActive,
    mustChangePass: user.mustChangePass,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getCurrentUser() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isActive) return null;
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  if (user.role !== 'ADMIN') return { ok: false, status: 403, error: 'Apenas o administrador pode alterar acessos.' };
  return { ok: true, user };
}

export async function requireMenuAccess(permission) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  if (!allowedPermissionKeys.has(permission) || (user.role !== 'ADMIN' && !normalizePermissions(user.menuPermissions).includes(permission))) {
    return { ok: false, status: 403, error: 'Acesso não autorizado.' };
  }
  return { ok: true, user };
}

export { prisma };
