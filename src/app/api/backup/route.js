import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';
import { prisma, requireAdmin } from '@/lib/authorization';

export const runtime = 'nodejs';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const [people, teamLinks, targets, directorProfiles, directorLinks, users] = await Promise.all([
    prisma.teamPerson.findMany({ include: { contracts: { include: { stages: true } } } }),
    prisma.teamCpLink.findMany(), prisma.billingTarget.findMany(), prisma.directorProfile.findMany(),
    prisma.directorCpLink.findMany(),
    prisma.user.findMany({ select: { id: true, username: true, displayName: true, role: true, menuPermissions: true, isActive: true } }),
  ]);
  const generatedAt = new Date().toISOString();
  const archive = archiver('zip', { zlib: { level: 6 } });
  const output = new PassThrough();
  archive.pipe(output);
  archive.on('error', (error) => output.destroy(error));
  archive.append(JSON.stringify({ generatedAt, format: 1, source: 'OAE_FIN', filesOutsideSystem: 'Os links de documentos da Equipe apontam para arquivos externos. Faça cópia desses arquivos no serviço de origem.', financialSource: 'CP_GERAL, CR_GERAL e PROJETOS_2026 são sincronizados da planilha base e não estão neste backup.' }, null, 2), { name: 'manifesto.json' });
  archive.append(JSON.stringify({ people, teamLinks, targets, directorProfiles, directorLinks, users }, null, 2), { name: 'dados/gestao.json' });
  archive.finalize().catch((error) => { console.error('Backup export:', error); output.destroy(error); });

  const filename = `oae-fin-backup-${generatedAt.slice(0, 10)}.zip`;
  return new Response(Readable.toWeb(output), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
