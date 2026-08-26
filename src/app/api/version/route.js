import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'financial-rules-v3',
    receita: 'liquida',
    recebido: 'liquido',
    entradasRealizadas: 'liquidas',
    brutoSomenteEm: ['Receita Bruta', 'Faturamento', 'DRE'],
  });
}
