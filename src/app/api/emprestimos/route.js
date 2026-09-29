import { NextResponse } from 'next/server';
import { prisma, requireLoansAccess } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { loanPayload, reconcileLoans } from '@/lib/loans';

export async function GET() {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const [contracts, snapshot] = await Promise.all([
      prisma.loanContract.findMany({ include: { installments: { orderBy: { number: 'asc' } }, documents: { select: { id: true, filename: true, createdAt: true } } }, orderBy: { createdAt: 'desc' } }),
      readCurrentSnapshot(),
    ]);
    return NextResponse.json({ contracts: reconcileLoans(contracts, snapshot), snapshotAt: snapshot?.updatedAt || null });
  } catch (error) {
    console.error('Load loans:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os empréstimos.' }, { status: 500 });
  }
}

export async function POST(request) {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const { installments, ...data } = loanPayload(await request.json());
    const contract = await prisma.loanContract.create({ data: {
      ...data, createdBy: access.user.username,
      installments: { create: installments },
    } });
    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um contrato com esse Documento CP.' }, { status: 409 });
    if (error instanceof SyntaxError || error.message?.startsWith('Informe') || error.message?.includes('inválid') || error.message?.startsWith('Confira') || error.message?.startsWith('Há parcelas')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Create loan:', error);
    return NextResponse.json({ error: 'Não foi possível salvar o empréstimo.' }, { status: 500 });
  }
}
