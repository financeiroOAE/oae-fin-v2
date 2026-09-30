import { NextResponse } from 'next/server';
import { prisma, requireMenuAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { revenueTitles } from '@/lib/managementSources';
import { monthOf } from '@/lib/managementSources';
import { isRealizedFinancialStatus, isForecastFinancialStatus } from '@/lib/financialClassification';
import { getProjectKey } from '@/lib/projectRules';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  const access = await requireMenuAccess('previsao_faturamento');
  if (!access.ok) return fail(access.error, access.status);
  const month = new URL(request.url).searchParams.get('month') || new Date().toISOString().slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return fail('Mês inválido.');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [snapshot, targets] = await Promise.all([readCurrentSnapshot(), prisma.billingTarget.findMany({ where: { month: { gte: month < currentMonth ? month : currentMonth } } })]);
  const allTitles = revenueTitles(snapshot);
  const titles = allTitles.filter((row) => row.month === month);
  const expenses = (snapshot?.payload?.data || []).filter((row) => row.natureza === 'Saída' && monthOf(row.data) === month &&
    (isRealizedFinancialStatus(row) || isForecastFinancialStatus(row))).reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
  const projects = new Map();
  (snapshot?.payload?.projetos || []).forEach((item) => {
    const project = String(item.OBRA || '').trim();
    const key = getProjectKey(project);
    if (!key) return;
    if (!projects.has(key)) projects.set(key, { key, project, companies: new Set(), types: new Set(), contract: 0, billed: 0, billed2026: 0, balance: 0 });
    const group = projects.get(key);
    if (item.EMPRESA) group.companies.add(String(item.EMPRESA).trim());
    if (item.TIPO) group.types.add(String(item.TIPO).trim());
    group.contract += Number(item.CONTRATO) || 0;
    group.billed += Number(item['NF FATURADAS']) || 0;
    group.billed2026 += Number(item.FATURADO_2026) || 0;
    group.balance += Number(item['SALDO CONTRATUAL']) || 0;
  });
  const rows = [...projects.values()].map((item) => {
    const matched = titles.filter((title) => title.project && getProjectKey(title.project) === item.key);
    const valid = matched.filter((title) => !title.review);
    const saved = targets.filter((entry) => getProjectKey(entry.project) === item.key);
    const current = saved.filter((entry) => entry.month === month);
    const actual = valid.filter((title) => title.realized).reduce((sum, title) => sum + title.value, 0);
    const realizedCurrentMonth = allTitles.filter((title) => title.month === currentMonth && title.realized && !title.review && getProjectKey(title.project) === item.key)
      .reduce((sum, title) => sum + title.value, 0);
    const allocated = saved.filter((entry) => entry.month >= currentMonth).reduce((sum, entry) => {
      const paidThisMonth = entry.month === currentMonth ? realizedCurrentMonth : 0;
      return sum + Math.max(0, Number(entry.amount) - paidThisMonth);
    }, 0);
    return { key: item.key, project: item.project, companies: [...item.companies], types: [...item.types],
      contract: item.contract, billed: item.billed, billed2026: item.billed2026, balance: item.balance,
      allocated, unallocated: Math.max(0, item.balance - allocated),
      target: current.length ? current.reduce((sum, entry) => sum + Number(entry.amount), 0) : null,
      imported: valid.filter((title) => title.forecast).reduce((sum, title) => sum + title.value, 0), actual,
      titles: matched, schedule: saved.filter((entry) => entry.month >= currentMonth).map((entry) => ({ month: entry.month, amount: Number(entry.amount) })).sort((a, b) => a.month.localeCompare(b.month)) };
  }).sort((a, b) => b.balance - a.balance);
  return NextResponse.json({ month, rows, expenses, review: titles.filter((title) => title.review),
    dateFallbackCount: titles.filter((title) => title.realized && title.dateSource !== 'EMISSAO').length,
    snapshotAt: snapshot?.updatedAt || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const access = await requireMenuAccess('previsao_faturamento');
  if (!access.ok) return fail(access.error, access.status);
  try {
    const { month, project, amount } = await request.json();
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) return fail('Mês inválido.');
    const snapshot = await readCurrentSnapshot();
    const projectKey = getProjectKey(project);
    const projectRows = (snapshot?.payload?.projetos || []).filter((item) => getProjectKey(item.OBRA) === projectKey);
    if (!projectRows.length || !projectRows.some((item) => String(item.OBRA || '').trim() === project)) return fail('Projeto não encontrado na base financeira.');
    const value = Number(amount);
    const actualThisMonth = revenueTitles(snapshot).filter((title) => title.month === month && getProjectKey(title.project) === projectKey && title.realized && !title.review)
      .reduce((sum, title) => sum + title.value, 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const balance = projectRows.reduce((sum, row) => sum + (Number(row['SALDO CONTRATUAL']) || 0), 0);
    const future = await prisma.billingTarget.findMany({ where: { month: { gte: currentMonth } } });
    const currentRealized = revenueTitles(snapshot).filter((title) => title.month === currentMonth && title.realized && !title.review && getProjectKey(title.project) === projectKey)
      .reduce((sum, title) => sum + title.value, 0);
    const otherCommitted = future.filter((entry) => getProjectKey(entry.project) === projectKey).reduce((sum, entry) => sum + Math.max(0, Number(entry.amount) - (entry.month === currentMonth ? currentRealized : 0)), 0);
    const availableAtStart = balance + (month === currentMonth ? actualThisMonth : 0) - (month >= currentMonth ? otherCommitted : 0);
    if (!Number.isFinite(value) || value < 0 || value > availableAtStart + 0.01) return fail('Meta deve estar dentro do saldo contratual, considerando as NF já feitas no mês.');
    const target = await prisma.billingTarget.create({ data: { month, project, amount: value, createdBy: access.user.username } });
    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') return fail('A meta deste projeto já foi registrada para o mês. A meta original permanece guardada.', 409);
    console.error('Save billing target:', error);
    return fail('Não foi possível registrar a meta.', 500);
  }
}
