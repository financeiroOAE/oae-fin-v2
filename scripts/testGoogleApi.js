const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function testOAuth() {
  console.log('--- Iniciando Teste Isolado OAuth2 ---');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('ERRO: Credenciais OAuth ausentes no .env.local');
    process.exit(1);
  }

  try {
    console.log('1. Instanciando OAuth2Client...');
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    
    oAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    console.log('2. Tentando obter Access Token via Refresh Token...');
    const tokenInfo = await oAuth2Client.getAccessToken();
    console.log(' -> Sucesso! Access Token obtido (não exibido por segurança).');

    console.log(`3. Testando leitura no Sheets: ${spreadsheetId}`);
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'EMPRESAS!A1:J10',
    });

    console.log(' -> Leitura bem sucedida!');
    console.log(` -> Linhas retornadas: ${response.data.values ? response.data.values.length : 0}`);
    if (response.data.values && response.data.values.length > 0) {
      console.log(` -> Cabeçalho: ${JSON.stringify(response.data.values[0])}`);
    }

  } catch (error) {
    console.error('\n!!! FALHA NO TESTE ISOLADO !!!');
    
    // Log seguro e detalhado conforme solicitado
    const erroSeguro = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      apiMessage: error.response?.data?.error?.message,
    };
    
    console.error(JSON.stringify(erroSeguro, null, 2));
  }
}

testOAuth();
