import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const history = await prisma.syncHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, data: history });
  } catch {
    return NextResponse.json({ error: 'Falha ao buscar histórico' }, { status: 500 });
  }
}
