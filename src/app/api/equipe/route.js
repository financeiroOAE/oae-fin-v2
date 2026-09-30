import { NextResponse } from 'next/server';
import { prisma, requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows } from '@/lib/managementSources';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });
const short = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const money = (value) => { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 999999999999) throw new Error('Valor inválido.'); return n; };
const date = (value) => {
  if (!value) return null;
  if (!/^20\d{2}-(0[1-9]|1[0-2])-[0-3]\d$/.test(String(value))) throw new Error('Data inválida.');
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Data inválida.');
  return parsed;
};

export async function GET(request) {
  const access = await requireMenuAccess('equipe');
  if (!access.ok) return fail(access.error, access.status);
  const [people, snapshot, links] = await Promise.all([
    prisma.teamPerson.findMany({ include: { contracts: { include: { stages: { orderBy: { dueDate: 'asc' } } }, orderBy: { createdAt: 'desc' } } }, orderBy: [{ department: 'asc' }, { name: 'asc' }] }),
    readCurrentSnapshot(), prisma.teamCpLink.findMany(),
  ]);
  const rows = cpRows(snapshot).filter((row) => row.teamAccount);
  const linkedKeys = new Set(links.map((link) => link.sourceKey));
  const q = String(new URL(request.url).searchParams.get('q') || '').trim().toUpperCase();
  const candidates = q.length >= 3 ? rows.filter((row) => !linkedKeys.has(row.sourceKey) &&
    [row.nome, row.documento, row.titulo, row.projeto].some((value) => String(value || '').toUpperCase().includes(q))).slice(0, 30) : [];
  return NextResponse.json({ people, links, cp: rows.filter((row) => linkedKeys.has(row.sourceKey)), candidates, snapshotAt: snapshot?.updatedAt || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const access = await requireMenuAccess('equipe');
  if (!access.ok) return fail(access.error, access.status);
  try {
    const body = await request.json();
    if (body.type === 'person') {
      const name = short(body.name), department = short(body.department);
      if (!name || !department) return fail('Informe pessoa e departamento.');
      const data = { name, department, relationship: short(body.relationship, 60) || 'PJ', modality: short(body.modality, 60) || null,
        jobTitle: short(body.jobTitle) || null, company: short(body.company) || null, email: short(body.email) || null,
        phone: short(body.phone, 50) || null, cpBeneficiary: short(body.cpBeneficiary) || null,
        status: body.status === 'INATIVO' ? 'INATIVO' : 'ATIVO' };
      const person = body.id ? await prisma.teamPerson.update({ where: { id: short(body.id, 60) }, data }) : await prisma.teamPerson.create({ data });
      return NextResponse.json({ person });
    }
    if (body.type === 'contract') {
      const personId = short(body.personId, 60), project = short(body.project), object = short(body.object, 2000);
      if (!personId || !project || !object) return fail('Informe pessoa, obra e objeto do contrato.');
      if (!await prisma.teamPerson.findUnique({ where: { id: personId }, select: { id: true } })) return fail('Pessoa não encontrada.', 404);
      const documentUrl = short(body.documentUrl, 500);
      if (documentUrl && !/^https:\/\//i.test(documentUrl)) return fail('Use um link HTTPS para o documento externo.');
      const data = { personId, project, object, contractNumber: short(body.contractNumber) || null, documentUrl: documentUrl || null,
        accountCode: short(body.accountCode, 30) || null, amount: money(body.amount), startDate: date(body.startDate), endDate: date(body.endDate),
        status: ['ATIVO', 'CONCLUIDO', 'SUSPENSO'].includes(body.status) ? body.status : 'ATIVO' };
      const contract = body.id ? await prisma.teamContract.update({ where: { id: short(body.id, 60) }, data }) : await prisma.teamContract.create({ data });
      return NextResponse.json({ contract });
    }
    if (body.type === 'stage') {
      const contractId = short(body.contractId, 60), label = short(body.label);
      if (!contractId || !label || !body.dueDate) return fail('Informe contrato, etapa e vencimento.');
      const stage = await prisma.teamStage.create({ data: { contractId, label, dueDate: date(body.dueDate), amount: money(body.amount), cpDocument: short(body.cpDocument) || null } });
      return NextResponse.json({ stage });
    }
    if (body.type === 'link') {
      const sourceKey = short(body.sourceKey, 80), personId = short(body.personId, 60), contractId = short(body.contractId, 60) || null;
      const snapshot = await readCurrentSnapshot();
      const source = cpRows(snapshot).find((row) => row.sourceKey === sourceKey && row.teamAccount);
      if (!source) return fail('Título não localizado na base de equipe atual.');
      const person = await prisma.teamPerson.findUnique({ where: { id: personId }, select: { id: true } });
      if (!person) return fail('Pessoa não encontrada.');
      if (contractId && !await prisma.teamContract.findFirst({ where: { id: contractId, personId }, select: { id: true } })) return fail('Contrato não pertence a essa pessoa.');
      const link = await prisma.teamCpLink.create({ data: { sourceKey, personId, contractId } });
      return NextResponse.json({ link });
    }
    return fail('Operação inválida.');
  } catch (error) {
    if (error?.code === 'P2002') return fail('Este título já foi vinculado.', 409);
    if (error?.code === 'P2025') return fail('Registro não encontrado.', 404);
    if (error instanceof SyntaxError || ['Valor inválido.', 'Data inválida.'].includes(error.message)) return fail(error.message);
    console.error('Save team record:', error);
    return fail('Não foi possível salvar as informações da equipe.', 500);
  }
}

export async function DELETE(request) {
  const access = await requireMenuAccess('equipe');
  if (!access.ok) return fail(access.error, access.status);
  const sourceKey = new URL(request.url).searchParams.get('sourceKey');
  if (!sourceKey) return fail('Informe o título.');
  await prisma.teamCpLink.deleteMany({ where: { sourceKey } });
  return NextResponse.json({ ok: true });
}
