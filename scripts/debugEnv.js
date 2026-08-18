const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function debug() {
  console.log('--- Verificação de Variáveis de Ambiente ---');
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log(`GOOGLE_CLIENT_ID existe? ${!!clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET existe? ${!!clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN existe? ${!!refreshToken}`);
  console.log(`GOOGLE_SPREADSHEET_ID existe? ${!!spreadsheetId}`);
  
  if (spreadsheetId) {
    console.log(`GOOGLE_SPREADSHEET_ID contém "/edit"? ${spreadsheetId.includes('/edit')}`);
    console.log(`GOOGLE_SPREADSHEET_ID tem ${spreadsheetId.length} caracteres.`);
  }

  console.log('\n--- Teste de Leitura EMPRESAS!A1:J10 ---');
  
  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'EMPRESAS!A1:J10',
    });
    console.log('Leitura bem-sucedida!');
  } catch (error) {
    const erroTecnico = {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      apiMessage: error.response?.data?.error?.message,
    };
    console.error(JSON.stringify(erroTecnico, null, 2));
  }
}

debug();
