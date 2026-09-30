import { NextResponse } from 'next/server';
import { prisma, requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows } from '@/lib/managementSources';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const categories = new Set(['FIXO', 'RETIRADA', 'REEMBOLSO', 'OUTRO']);

export async function GET(request) {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) return fail(access.error, access.status);
  const isAdmin = access.user.role === 'ADMIN';
  const url = new URL(request.url), q = String(url.searchParams.get('q') || '').trim().toUpperCase();
  const [profiles, snapshot] = await Promise.all([
    prisma.directorProfile.findMany({ where: isAdmin ? {} : { userId: access.user.id }, include: { cpLinks: true }, orderBy: { name: 'asc' } }),
    readCurrentSnapshot(),
  ]);
  const rows = cpRows(snapshot);
  const byKey = new Map(rows.map((row) => [row.sourceKey, row]));
  const visible = profiles.map((profile) => ({ ...profile, cpLinks: profile.cpLinks.map((link) => ({ ...link, source: byKey.get(link.sourceKey) || null })) }));
  const linked = new Set(visible.flatMap((profile) => profile.cpLinks.map((link) => link.sourceKey)));
  const candidates = isAdmin && q.length >= 3 ? rows.filter((row) => !linked.has(row.sourceKey) &&
    [row.nome, row.documento, row.titulo, row.contaNome, row.projeto].some((value) => String(value || '').toUpperCase().includes(q))).slice(0, 50) : [];
  return NextResponse.json({ profiles: visible, candidates, snapshotAt: snapshot?.updatedAt || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) return fail(access.error, access.status);
  if (access.user.role !== 'ADMIN') return fail('Somente o administrador pode vincular títulos.', 403);
  try {
    const body = await request.json();
    if (body.type === 'profile') {
      const name = String(body.name || '').trim().slice(0, 160);
      if (!name) return fail('Informe o nome do diretor.');
      const userId = String(body.userId || '').trim() || null;
      if (userId && !await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) return fail('Usuário não encontrado.');
      const profile = body.id ? await prisma.directorProfile.update({ where: { id: body.id }, data: { name, userId } })
        : await prisma.directorProfile.create({ data: { name, userId } });
      return NextResponse.json({ profile });
    }
    if (body.type === 'link') {
      const sourceKey = String(body.sourceKey || ''), profileId = String(body.profileId || '');
      const snapshot = await readCurrentSnapshot();
      const source = cpRows(snapshot).find((row) => row.sourceKey === sourceKey);
      if (!source) return fail('Título não encontrado na base atual.');
      if (!await prisma.directorProfile.findUnique({ where: { id: profileId }, select: { id: true } })) return fail('Perfil não encontrado.');
      if (!categories.has(body.category)) return fail('Escolha a natureza do pagamento.');
      const allocations = Array.isArray(body.allocations) ? body.allocations.map((item) => ({ project: String(item.project || '').trim().slice(0, 160), amount: Number(item.amount) })) : [];
      if (allocations.some((item) => !item.project || !Number.isFinite(item.amount) || item.amount <= 0)) return fail('Confira os valores alocados.');
      const allocated = allocations.reduce((sum, item) => sum + item.amount, 0);
      if (allocated > source.valor + 0.01) return fail('A distribuição supera o valor do título.');
      const link = await prisma.directorCpLink.create({ data: { sourceKey, profileId, category: body.category, allocations, note: String(body.note || '').trim().slice(0, 400) || null } });
      return NextResponse.json({ link });
    }
    return fail('Operação inválida.');
  } catch (error) {
    if (error?.code === 'P2002') return fail('Título ou usuário já vinculado a outro perfil.', 409);
    console.error('Save director record:', error);
    return fail('Não foi possível salvar o controle dos diretores.', 500);
  }
}

export async function DELETE(request) {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) return fail(access.error, access.status);
  if (access.user.role !== 'ADMIN') return fail('Somente o administrador pode retirar vínculos.', 403);
  const sourceKey = new URL(request.url).searchParams.get('sourceKey');
  if (!sourceKey) return fail('Informe o título.');
  await prisma.directorCpLink.deleteMany({ where: { sourceKey } });
  return NextResponse.json({ ok: true });
}
