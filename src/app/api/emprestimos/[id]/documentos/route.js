import { NextResponse } from 'next/server';
import { prisma, requireLoansAccess } from '@/lib/authorization';

export async function POST(request, { params }) {
  const access = await requireLoansAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const contract = await prisma.loanContract.findUnique({ where: { id }, select: { id: true } });
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size === 0 || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Envie um PDF de até 5 MB.' }, { status: 400 });
  }
  const content = Buffer.from(await file.arrayBuffer());
  if (content.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'O arquivo não é um PDF válido.' }, { status: 400 });
  try {
    const document = await prisma.loanDocument.create({ data: { contractId: id, filename: file.name.slice(0, 160), mimeType: 'application/pdf', content }, select: { id: true, filename: true, createdAt: true } });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Upload loan PDF:', error);
    return NextResponse.json({ error: 'Não foi possível anexar o PDF.' }, { status: 500 });
  }
}
