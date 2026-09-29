import { NextResponse } from 'next/server';
import { prisma, requireLoansAccess } from '@/lib/authorization';

export async function GET(_request, { params }) {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id, documentId } = await params;
  const document = await prisma.loanDocument.findFirst({ where: { id: documentId, contractId: id } });
  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  return new NextResponse(document.content, { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="contrato.pdf"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
