import { NextResponse } from 'next/server';
import { getCurrentUser, normalizePermissions, prisma } from '@/lib/authorization';

function canViewForecast(user) {
  if (!user) return false;
  if (String(user.username || '').trim().toLowerCase() === 'admin') return true;
  return normalizePermissions(user.menuPermissions).includes('previsao_faturamento');
}

function canEditForecast(user) {
  return String(user?.username || '').trim().toLowerCase() === 'admin';
}

function safeForecast(item) {
  return {
    id: item.id,
    sourceKey: item.sourceKey || null,
    project: item.project,
    document: item.document || '',
    forecastDate: item.forecastDate,
    amount: Number(item.amount) || 0,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function parseInput(body) {
  const project = String(body?.project || '').trim();
  const document = String(body?.document || '').trim();
  const sourceKey = String(body?.sourceKey || '').trim() || null;
  const forecastDate = new Date(body?.forecastDate);
  const amount = Number(body?.amount);

  if (!project || project.length > 180) throw new Error('Informe um projeto válido.');
  if (document.length > 120) throw new Error('O documento deve ter no máximo 120 caracteres.');
  if (sourceKey && sourceKey.length > 200) throw new Error('Identificador da previsão inválido.');
  if (
    Number.isNaN(forecastDate.getTime())
    || forecastDate.getFullYear() !== 2026
    || forecastDate.getMonth() < 8
    || forecastDate.getMonth() > 11
  ) {
    throw new Error('A competência prevista deve estar entre setembro e dezembro de 2026.');
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor previsto maior que zero.');

  return { project, document: document || null, sourceKey, forecastDate, amount };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  if (!canViewForecast(user)) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });

  const forecasts = await prisma.billingForecast.findMany({
    orderBy: [{ forecastDate: 'asc' }, { project: 'asc' }],
  });

  return NextResponse.json({
    forecasts: forecasts.map(safeForecast),
    canEdit: canEditForecast(user),
  });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  if (!canEditForecast(user)) return NextResponse.json({ error: 'Somente o login admin pode alterar previsões.' }, { status: 403 });

  try {
    const body = await request.json();
    const data = parseInput(body);
    const auditData = {
      ...data,
      isActive: true,
      updatedBy: user.username,
    };

    let forecast;
    if (body.id) {
      forecast = await prisma.billingForecast.update({
        where: { id: String(body.id) },
        data: auditData,
      });
    } else if (data.sourceKey) {
      forecast = await prisma.billingForecast.upsert({
        where: { sourceKey: data.sourceKey },
        update: auditData,
        create: { ...auditData, createdBy: user.username },
      });
    } else {
      forecast = await prisma.billingForecast.create({
        data: { ...auditData, createdBy: user.username },
      });
    }

    return NextResponse.json({ forecast: safeForecast(forecast) }, { status: body.id ? 200 : 201 });
  } catch (error) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Previsão não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: error?.message || 'Não foi possível salvar a previsão.' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  if (!canEditForecast(user)) return NextResponse.json({ error: 'Somente o login admin pode excluir previsões.' }, { status: 403 });

  try {
    const body = await request.json();

    if (body.id) {
      const forecast = await prisma.billingForecast.update({
        where: { id: String(body.id) },
        data: { isActive: false, updatedBy: user.username },
      });
      return NextResponse.json({ forecast: safeForecast(forecast) });
    }

    const data = parseInput(body);
    if (!data.sourceKey) return NextResponse.json({ error: 'Identificador da previsão não informado.' }, { status: 400 });

    const forecast = await prisma.billingForecast.upsert({
      where: { sourceKey: data.sourceKey },
      update: { isActive: false, updatedBy: user.username },
      create: {
        ...data,
        isActive: false,
        createdBy: user.username,
        updatedBy: user.username,
      },
    });

    return NextResponse.json({ forecast: safeForecast(forecast) });
  } catch (error) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Previsão não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: error?.message || 'Não foi possível excluir a previsão.' }, { status: 400 });
  }
}
