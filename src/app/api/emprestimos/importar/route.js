import { NextResponse } from 'next/server';
import { prisma, requireLoansAccess } from '@/lib/authorization';
import { loanPayload } from '@/lib/loans';

export async function POST(request) {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json();
    if (!Array.isArray(body.contracts) || body.contracts.length < 1 || body.contracts.length > 100) {
      return NextResponse.json({ error: 'Informe de 1 a 100 contratos.' }, { status: 400 });
    }
    const entries = body.contracts.map((row) => loanPayload(row));
    if (entries.some((row) => !row.sourceKey || row.installments.length)) {
      return NextResponse.json({ error: 'A importação exige identificação de origem e não importa parcelas.' }, { status: 400 });
    }
    if (new Set(entries.map((row) => row.sourceKey)).size !== entries.length) {
      return NextResponse.json({ error: 'Há contratos repetidos no arquivo.' }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const added = [];
      const skipped = [];
      for (const { installments, ...data } of entries) {
        const existing = await tx.loanContract.findFirst({ where: { OR: [
          { sourceKey: data.sourceKey },
          ...(data.cpDocument ? [{ cpDocument: data.cpDocument }] : []),
          ...(data.contractNumber ? [{ bank: data.bank, contractNumber: data.contractNumber }] : []),
        ] } });
        if (existing) { skipped.push(data.sourceKey); continue; }
        const contract = await tx.loanContract.create({ data: { ...data, createdBy: access.user.username } });
        added.push({ sourceKey: contract.sourceKey, id: contract.id });
      }
      return { added, skipped };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Há um contrato já cadastrado com este número ou documento CP.' }, { status: 409 });
    if (error instanceof SyntaxError || /Informe|inválid|Confira|Há parcelas|Valor contratado/.test(error.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Import loans:', error);
    return NextResponse.json({ error: 'Não foi possível importar os contratos.' }, { status: 500 });
  }
}
