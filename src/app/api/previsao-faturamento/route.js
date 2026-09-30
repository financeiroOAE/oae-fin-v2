import { NextResponse } from 'next/server';
import { prisma, requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { revenueTitles } from '@/lib/managementSources';
import { monthOf } from '@/lib/managementSources';
import { isRealizedFinancialStatus, isForecastFinancialStatus } from '@/lib/financialClassification';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  const access = await requireMenuAccess('previsao_faturamento');
  if (!access.ok) return fail(access.error, access.status);
  const month = new URL(request.url).searchParams.get('month') || new Date().toISOString().slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return fail('Mês inválido.');
  const [snapshot, targets] = await Promise.all([readCurrentSnapshot(), prisma.billingTarget.findMany({ where: { month } })]);
  const titles = revenueTitles(snapshot).filter((row) => row.month === month);
  const expenses = (snapshot?.payload?.data || []).filter((row) => row.natureza === 'Saída' && monthOf(row.data) === month &&
    (isRealizedFinancialStatus(row) || isForecastFinancialStatus(row))).reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
  const projects = (snapshot?.payload?.projetos || []).map((item) => ({ project: String(item.OBRA || '').trim(), contract: Number(item.CONTRATO) || 0,
    billed: Number(item['NF FATURADAS']) || 0, balance: Number(item['SALDO CONTRATUAL']) || 0 })).filter((item) => item.project);
  const rows = projects.map((item) => {
    const byProject = titles.filter((title) => title.project === item.project && !title.review);
    const target = targets.find((entry) => entry.project === item.project);
    return { ...item, target: target ? Number(target.amount) : null, imported: byProject.filter((title) => title.forecast).reduce((sum, title) => sum + title.value, 0),
      actual: byProject.filter((title) => title.realized).reduce((sum, title) => sum + title.value, 0), titles: titles.filter((title) => title.project === item.project) };
  });
  return NextResponse.json({ month, rows, expenses, review: titles.filter((title) => title.review), snapshotAt: snapshot?.updatedAt || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const access = await requireMenuAccess('previsao_faturamento');
  if (!access.ok) return fail(access.error, access.status);
  try {
    const { month, project, amount } = await request.json();
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) return fail('Mês inválido.');
    const snapshot = await readCurrentSnapshot();
    const row = (snapshot?.payload?.projetos || []).find((item) => String(item.OBRA || '').trim() === project);
    if (!row) return fail('Projeto não encontrado na base financeira.');
    const value = Number(amount);
    const actualThisMonth = revenueTitles(snapshot).filter((title) => title.month === month && title.project === project && title.realized && !title.review)
      .reduce((sum, title) => sum + title.value, 0);
    const availableAtStart = Number(row['SALDO CONTRATUAL'] || 0) + actualThisMonth;
    if (!Number.isFinite(value) || value < 0 || value > availableAtStart + 0.01) return fail('Meta deve estar dentro do saldo contratual, considerando as NF já feitas no mês.');
    const target = await prisma.billingTarget.create({ data: { month, project, amount: value, createdBy: access.user.username } });
    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') return fail('A meta deste projeto já foi registrada para o mês. A meta original permanece guardada.', 409);
    console.error('Save billing target:', error);
    return fail('Não foi possível registrar a meta.', 500);
  }
}
