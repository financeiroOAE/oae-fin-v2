import * as xlsx from 'xlsx';

/**
 * R05: Extrair código numérico da Conta e usar esse código como chave canônica
 */
export function extractAccountCode(contaString) {
  if (!contaString) return null;
  const parts = String(contaString).split('-');
  return parts[0].trim().replace(/\D/g, ''); // Garante que só pegue números antes do traço
}

/**
 * Validação de colunas baseadas no dicionário
 */
const REQUIRED_COLUMNS_CP = [
  'Data', 'Documento', 'Status', 'Tipo conta', 'Origem', 'Título', 'Nome', 
  'Valor total título', 'Valor', 'Código centro de custo', 'Nome centro de custo', 'Conta'
];

const REQUIRED_COLUMNS_CR = [
  'Data', 'Documento', 'Status', 'Tipo conta', 'Origem', 'Lançamento', 'Nome', 
  'Valor total título', 'Valor', 'Código centro de custo', 'Nome centro de custo', 'Conta'
];

/**
 * R13: Coluna desconhecida: Nunca inventar significado. Marcar COLUNA NÃO MAPEADA e interromper.
 */
export function validateHeaders(headers, requiredHeaders) {
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`COLUNA NÃO MAPEADA ou ausente. Faltam: ${missing.join(', ')}`);
  }
}

export function parseBRL(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const cleaned = String(value)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

/**
 * R01: Natureza financeira: CR_GERAL = Entrada; CP_GERAL = Saída.
 * R10: Importação CR: Ignorar linhas sem Data/Conta.
 */
export function processSiengeData(sheetData, type, deparaMap) {
  const isCR = type === 'CR_GERAL';
  const nature = isCR ? 'Entrada' : 'Saída';

  return sheetData
    .filter(row => {
      // R10: Ignorar linhas vazias ou de fórmulas (sem Data/Conta)
      const hasData = row.Data && String(row.Data).trim() !== '';
      const hasConta = row.Conta && String(row.Conta).trim() !== '';
      return hasData && hasConta;
    })
    .map(row => {
      // R05: Extrair código canônico
      const accountCode = extractAccountCode(row.Conta);
      
      // R06: DRE via DEPARA
      const dreInfo = deparaMap[accountCode] || {
        'DESCRIÇÃO DRE': 'PENDENTE DE CLASSIFICAÇÃO',
        'Classe Orçamentária': 'PENDENTE DE CLASSIFICAÇÃO',
        'Pacote': 'PENDENTE DE CLASSIFICAÇÃO',
        'Linha DRE': 'PENDENTE DE CLASSIFICAÇÃO'
      };

      // Normalizar Projeto a partir de Código e Nome para evitar perdas
      let rawCodigo = String(row['Código centro de custo'] || '').trim();
      let rawNome = String(row['Nome centro de custo'] || '').trim();
      
      let projetoResolvido = rawNome || rawCodigo || 'SEM PROJETO';
      
      // Se há apenas o código "490", tentar expandir procurando na mesma base o nome completo
      if (rawCodigo && rawNome === '') {
         const found = sheetData.find(r => String(r['Código centro de custo'] || '').trim() === rawCodigo && String(r['Nome centro de custo'] || '').trim() !== '');
         if (found) {
             projetoResolvido = String(found['Nome centro de custo']).trim();
         } else {
             projetoResolvido = rawCodigo;
         }
      }

      // R07: Tratar Datas
      // R04: Valor agregado

      // Nome da conta diretamente do lançamento (ex: "2030101 - PIS" → "PIS")
      const contaRaw = String(row.Conta || '').trim();
      const contaDashIdx = contaRaw.indexOf(' - ');
      const contaNomeOriginal = contaDashIdx >= 0
        ? contaRaw.slice(contaDashIdx + 3).trim()
        : contaRaw;

      return {
        natureza: nature,
        data: row.Data,
        documento: String(row.Documento || ''), // R03
        status: String(row.Status || '').trim(), // R08
        projeto: projetoResolvido, // R02
        projetoCodigoOriginal: rawCodigo, // Extra meta para debugging
        origemSienge: String(row.Origem || '').trim(), // R12
        nome: String(row.Nome || '').trim(),
        valor: parseBRL(row.Valor), // R04 e R16
        lancamento: String(row['Lançamento'] || row['Lanamento'] || '').trim(),
        valorTotalTitulo: parseBRL(row['Valor total título'] || row['Valor total ttulo']),
        contaCodigo: accountCode,
        contaNome: contaNomeOriginal,          // Nome real da conta (ex: PIS, COFINS, ISS)
        contaDescricao: dreInfo['DESCRIÇÃO DRE'], // Agrupador do DEPARA (ex: Retenções Fornecedores)
        dreClasse: dreInfo['Classe Orçamentária'],
        drePacote: dreInfo['Pacote'],
        dreLinha: dreInfo['Linha DRE']
      };
    });
}
