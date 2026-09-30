import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';
import { prisma, requireAdmin } from '@/lib/authorization';

export const runtime = 'nodejs';

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const [people, teamLinks, targets, directorProfiles, directorLinks, loans, documentList, forecasts, users] = await Promise.all([
    prisma.teamPerson.findMany({ include: { contracts: { include: { stages: true } } } }),
    prisma.teamCpLink.findMany(), prisma.billingTarget.findMany(), prisma.directorProfile.findMany(),
    prisma.directorCpLink.findMany(),
    prisma.loanContract.findMany({ include: { installments: true } }),
    prisma.loanDocument.findMany({ select: { id: true, contractId: true, filename: true, mimeType: true, createdAt: true } }),
    prisma.billingForecast.findMany(),
    prisma.user.findMany({ select: { id: true, username: true, displayName: true, role: true, menuPermissions: true, isActive: true } }),
  ]);
  const generatedAt = new Date().toISOString();
  const archive = archiver('zip', { zlib: { level: 6 } });
  const output = new PassThrough();
  archive.pipe(output);
  archive.on('error', (error) => output.destroy(error));
  archive.append(JSON.stringify({ generatedAt, format: 1, source: 'OAE_FIN', filesOutsideSystem: 'Os links de documentos da Equipe apontam para arquivos externos. Faça cópia desses arquivos no serviço de origem.', financialSource: 'CP_GERAL, CR_GERAL e PROJETOS_2026 são sincronizados da planilha base e não estão neste backup.' }, null, 2), { name: 'manifesto.json' });
  archive.append(JSON.stringify({ people, teamLinks, targets, directorProfiles, directorLinks, loans, forecasts, users }, null, 2), { name: 'dados/gestao.json' });
  archive.append(JSON.stringify(documentList, null, 2), { name: 'dados/documentos-emprestimos.json' });

  for (const document of documentList) {
    // Archiver consumes each stream in sequence, keeping at most one PDF in memory.
    archive.append(Readable.from((async function* () {
      const item = await prisma.loanDocument.findUnique({ where: { id: document.id }, select: { content: true } });
      if (item) yield Buffer.from(item.content);
    })()), { name: `documentos/emprestimos/${document.id}.pdf` });
  }
  archive.finalize().catch((error) => { console.error('Backup export:', error); output.destroy(error); });

  const filename = `oae-fin-backup-${generatedAt.slice(0, 10)}.zip`;
  return new Response(Readable.toWeb(output), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
