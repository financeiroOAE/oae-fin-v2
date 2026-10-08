import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const MENU_DEFINITIONS = [
  { key: 'inicio', label: 'Início', path: '/' },
  { key: 'visao_financeira', label: 'Visão Financeira', path: '/visao-financeira' },
  { key: 'fluxo_caixa', label: 'Fluxo de Caixa', path: '/fluxo-caixa' },
  { key: 'projetos', label: 'Projetos', path: '/projetos' },
  { key: 'equipe_gestao', label: 'Equipe', path: '/equipe' },
  { key: 'administrativo_geral', label: 'Visão Geral', group: 'Administrativo', path: '/administrativo' },
  { key: 'administrativo_diretoria', label: 'Diretoria', group: 'Administrativo', path: '/administrativo/socios' },
  { key: 'dre', label: 'DRE Gerencial', path: '/dre' },
  { key: 'configuracoes', label: 'Configurações', path: '/configuracoes' },
  { key: 'atualizacao_dados', label: 'Atualização de Dados', path: '/atualizacao-dados' },
  { key: 'historico', label: 'Histórico', path: '/historico' },
];

const allowedPermissionKeys = new Set(MENU_DEFINITIONS.map((item) => item.key));
const LEGACY_PERMISSION_MAP = {
  administrativo: ['administrativo_geral', 'administrativo_diretoria'],
};

export function normalizePermissions(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];

  const normalized = new Set();
  parsed.forEach((permission) => {
    if (allowedPermissionKeys.has(permission)) {
      normalized.add(permission);
      return;
    }
    (LEGACY_PERMISSION_MAP[permission] || []).forEach((mappedPermission) => {
      if (allowedPermissionKeys.has(mappedPermission)) normalized.add(mappedPermission);
    });
  });
  return [...normalized];
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

export function hasMenuAccess(user, permission) {
  if (!user || !allowedPermissionKeys.has(permission)) return false;
  if (user.role === 'ADMIN') return true;
  return normalizePermissions(user.menuPermissions).includes(permission);
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
  if (!hasMenuAccess(user, permission)) {
    return { ok: false, status: 403, error: 'Acesso não autorizado.' };
  }
  return { ok: true, user };
}

export async function requireAnyMenuAccess(permissions) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
  const requested = Array.isArray(permissions) ? permissions : [permissions];
  if (!requested.some((permission) => hasMenuAccess(user, permission))) {
    return { ok: false, status: 403, error: 'Acesso não autorizado.' };
  }
  return { ok: true, user };
}

export { prisma };
