import { NextResponse } from 'next/server';
import { prisma, requireLoansAccess } from '@/lib/authorization';
import { loanPayload } from '@/lib/loans';

export async function PUT(request, { params }) {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const { id } = await params;
    const { installments, ...data } = loanPayload(await request.json());
    const existing = await prisma.loanContract.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });
    const contract = await prisma.$transaction(async (tx) => {
      await tx.loanInstallment.deleteMany({ where: { contractId: id } });
      return tx.loanContract.update({ where: { id }, data: { ...data, installments: { create: installments } } });
    });
    return NextResponse.json({ contract });
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Documento CP já usado por outro contrato.' }, { status: 409 });
    if (error instanceof SyntaxError || /Informe|inválid|Confira|Há parcelas/.test(error.message || '')) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Update loan:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o empréstimo.' }, { status: 500 });
  }
}
