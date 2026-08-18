import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { processSiengeData, validateHeaders, extractAccountCode } from '@/lib/businessRules';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    let allConsolidated = [];
    const deparaMap = {}; // No futuro, isso virá do arquivo Nomenclatura_OAE_FIN_FINAL.xlsx

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      
      const sheetName = workbook.SheetNames[0]; // Considerando que o nome da aba defina o tipo
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

      if (rawData.length === 0) continue;

      const headers = Object.keys(rawData[0]);
      let type = '';

      if (sheetName.includes('CP_GERAL') || headers.includes('Título')) {
        type = 'CP_GERAL';
        // validateHeaders(headers, REQUIRED_COLUMNS_CP); // Descomentar quando DEPARA real estiver pronto
      } else if (sheetName.includes('CR_GERAL') || headers.includes('Lançamento')) {
        type = 'CR_GERAL';
      } else {
        throw new Error(`Aba ou formato desconhecido: ${sheetName}`);
      }

      const processed = processSiengeData(rawData, type, deparaMap);
      allConsolidated = [...allConsolidated, ...processed];
    }

    return NextResponse.json({ 
      success: true, 
      message: `${allConsolidated.length} registros consolidados com sucesso!`,
      data: allConsolidated 
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({ 
      error: 'Falha na importação. O painel anterior continua disponível.', 
      details: error.message 
    }, { status: 500 });
  }
}
