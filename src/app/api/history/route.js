import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const history = await prisma.syncHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao buscar histórico' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
