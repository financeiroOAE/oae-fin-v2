import { google } from 'googleapis';

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getGoogleSheetsClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.sheets({ version: 'v4', auth: oAuth2Client });
}

export async function batchReadSheets() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID não está configurado.');
  }

  const sheets = await getGoogleSheetsClient();

  const ranges = [
    'EMPRESAS!A:J',
    'PROJETOS_2026!A:L',
    'CENTROS_CUSTO!A:E',
    'PLANOS_FINANCEIROS!A:E',
    'CP_GERAL!A:L',
    'CR_GERAL!A:N',
    'DEPARA!A:F'
  ];

  const resultData = {
    EMPRESAS: [],
    PROJETOS_2026: [],
    CENTROS_CUSTO: [],
    PLANOS_FINANCEIROS: [],
    CP_GERAL: [],
    CR_GERAL: [],
    DEPARA: []
  };

  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS'
    });

    response.data.valueRanges.forEach((rangeData) => {
      const sheetNameMatch = rangeData.range.match(/^'?([^!']+)'?!/);
      const sheetName = sheetNameMatch ? sheetNameMatch[1] : rangeData.range.split('!')[0];

      const values = rangeData.values || [];
      const rows = values.length > 0 ? values.slice(1) : [];
      const headers = values.length > 0 ? values[0].map(normalizeHeader) : [];

      console.log(`[Google Sheets Diagnostic] Aba: ${sheetName}`);
      console.log(` - Range retornado: ${rangeData.range}`);
      console.log(` - Quantidade de linhas de dados: ${rows.length}`);
      console.log(` - Cabeçalho normalizado: ${headers.length > 0 ? JSON.stringify(headers) : 'VAZIO'}`);

      if (rows.length > 0) {
        const data = rows.map((row) => {
          const rowData = {};
          headers.forEach((header, index) => {
            if (!header) return;
            rowData[header] = row[index] ?? '';
          });

          // Coluna L da PROJETOS_2026: faturamento acumulado do ano de 2026.
          // O alias por posicao evita depender de variacoes no texto do cabecalho da planilha.
          if (sheetName === 'PROJETOS_2026') {
            rowData.FATURADO_2026_COL_L = row[11] ?? '';
          }

          return rowData;
        });

        if (resultData[sheetName] !== undefined) {
          resultData[sheetName] = data;
        } else {
          const baseName = Object.keys(resultData).find((key) => sheetName.includes(key));
          if (baseName) resultData[baseName] = data;
        }
      }
    });

    return resultData;
  } catch (error) {
    console.error('Erro no batchGet do Google Sheets:', error.message);
    throw error;
  }
}
