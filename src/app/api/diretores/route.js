import { NextResponse } from 'next/server';
import { prisma, requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows } from '@/lib/managementSources';
import { DIRECTORS, buildDirectorReports, directorForRow } from '@/lib/directorReporting';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const categories = new Set(['FIXO', 'RETIRADA', 'REEMBOLSO', 'OUTRO']);

export async function GET() {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) return fail(access.error, access.status);
  const [snapshot, overrides] = await Promise.all([readCurrentSnapshot(), prisma.directorCpLink.findMany()]);
  const profiles = buildDirectorReports(cpRows(snapshot), overrides);
  return NextResponse.json({ profiles, snapshotAt: snapshot?.updatedAt || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const access = await requireMenuAccess('diretores');
  if (!access.ok) return fail(access.error, access.status);
  if (access.user.role !== 'ADMIN') return fail('Somente o administrador pode classificar pagamentos.', 403);
  try {
    const { sourceKey, category } = await request.json();
    if (!categories.has(category)) return fail('Escolha uma natureza válida.');
    const source = cpRows(await readCurrentSnapshot()).find((row) => row.sourceKey === sourceKey);
    const director = source && directorForRow(source);
    if (!director) return fail('Pagamento não encontrado para Celi Barba ou Paulo Henrique Araújo.');
    const profile = DIRECTORS.find((item) => item.id === director.id);
    await prisma.directorProfile.upsert({ where: { id: profile.id }, create: { id: profile.id, name: profile.name }, update: { name: profile.name } });
    const link = await prisma.directorCpLink.upsert({ where: { sourceKey },
      create: { sourceKey, profileId: profile.id, category }, update: { profileId: profile.id, category } });
    return NextResponse.json({ link });
  } catch (error) {
    console.error('Classify director payment:', error);
    return fail('Não foi possível classificar o pagamento.', 500);
  }
}
