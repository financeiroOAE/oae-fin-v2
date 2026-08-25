import * as xlsx from 'xlsx';
import { isProjectOngoing } from '@/lib/projectRules';

/**
 * R05: Extrair código numérico da Conta e usar esse código como chave canônica
 */
export function extractAccountCode(contaString) {
  if (!contaString) return null;
  const parts = String(contaString).split('-');
  return parts[0].trim().replace(/\D/g, '');
}

const REQUIRED_COLUMNS_CP = [
  'Data', 'Documento', 'Status', 'Tipo conta', 'Origem', 'Título', 'Nome',
  'Valor total título', 'Valor', 'Código centro de custo', 'Nome centro de custo', 'Conta'
];

const REQUIRED_COLUMNS_CR = [
  'Data', 'Documento', 'Status', 'Tipo conta', 'Origem', 'Lançamento', 'Nome',
  'Valor total título', 'Valor', 'Código centro de custo', 'Nome centro de custo', 'Conta'
];

export function validateHeaders(headers, requiredHeaders) {
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`COLUNA NÃO MAPEADA ou ausente. Faltam: ${missing.join(', ')}`);
  }
}

export function parseBRL(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const cleaned = String(value)
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function projectCode(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const match = normalized.match(/^(?:P\s*\.?\s*)?(\d+(?:A\d+)?)/);
  return match?.[1] || null;
}

function projectAliases(code) {
  const normalized = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return [];
  const aliases = new Set([normalized]);
  if (/^\d+A\d+$/.test(normalized)) aliases.add(normalized.replace('A', ''));
  return [...aliases];
}

function buildProjectIndex(projectCatalog = []) {
  const byAlias = new Map();

  projectCatalog.forEach((project) => {
    const label = String(project.OBRA || '').trim();
    if (!label) return;

    const codes = new Set([
      projectCode(project.ID),
      projectCode(project.OBRA),
    ].filter(Boolean));

    codes.forEach((code) => {
      projectAliases(code).forEach((alias) => {
        if (!byAlias.has(alias)) byAlias.set(alias, []);
        byAlias.get(alias).push({
          label,
          code,
          project,
          active: isProjectOngoing(project),
        });
      });
    });
  });

  const unique = new Map();
  byAlias.forEach((candidates, alias) => {
    const byLabel = new Map();
    candidates.forEach((candidate) => byLabel.set(normalizeText(candidate.label), candidate));
    const distinct = [...byLabel.values()];

    if (distinct.length === 1) {
      unique.set(alias, distinct[0]);
      return;
    }

    // Se um código existe em mais de um cadastro, só resolvemos automaticamente
    // quando exatamente um deles ainda está em andamento na relação oficial.
    const active = distinct.filter((candidate) => candidate.active);
    if (active.length === 1) unique.set(alias, active[0]);
  });

  return unique;
}

function documentProjectCandidates(documento) {
  const normalized = normalizeText(documento);
  if (!normalized) return [];

  const candidates = [];
  const add = (value) => projectAliases(value).forEach((alias) => {
    if (!candidates.includes(alias)) candidates.push(alias);
  });

  let match;
  const explicitProject = /(?:^|[^A-Z0-9])P\s*\.?\s*(\d{2,6}(?:A\d{1,3})?)/g;
  while ((match = explicitProject.exec(normalized))) add(match[1]);

  const trustedDocumentType = /\b(?:PCT|CTPA)\s*\.?\s*(?:P\s*\.?\s*)?(\d{2,6}(?:A\d{1,3})?)/g;
  while ((match = trustedDocumentType.exec(normalized))) add(match[1]);

  return candidates;
}

function resolveProjectFromDocument(documento, projectIndex) {
  for (const alias of documentProjectCandidates(documento)) {
    const match = projectIndex.get(alias);
    if (match) return match;
  }
  return null;
}

/**
 * R01: Natureza financeira: CR_GERAL = Entrada; CP_GERAL = Saída.
 * R10: Ignorar linhas sem Data/Conta.
 *
 * Para CR_GERAL, quando o Sienge retorna centro de custo genérico "1 / Grupo OAE",
 * o projeto só é recuperado se o Documento trouxer uma referência explícita P.xxx
 * (ou PCT/CTPA) e ela corresponder de forma única à relação PROJETOS_2026.
 */
export function processSiengeData(sheetData, type, deparaMap, projectCatalog = []) {
  const isCR = type === 'CR_GERAL';
  const nature = isCR ? 'Entrada' : 'Saída';
  const projectIndex = isCR ? buildProjectIndex(projectCatalog) : new Map();

  return sheetData
    .filter(row => {
      const hasData = row.Data && String(row.Data).trim() !== '';
      const hasConta = row.Conta && String(row.Conta).trim() !== '';
      return hasData && hasConta;
    })
    .map(row => {
      const accountCode = extractAccountCode(row.Conta);
      const dreInfo = deparaMap[accountCode] || {
        'DESCRIÇÃO DRE': 'PENDENTE DE CLASSIFICAÇÃO',
        'Classe Orçamentária': 'PENDENTE DE CLASSIFICAÇÃO',
        'Pacote': 'PENDENTE DE CLASSIFICAÇÃO',
        'Linha DRE': 'PENDENTE DE CLASSIFICAÇÃO'
      };

      const rawCodigo = String(row['Código centro de custo'] || '').trim();
      const rawNome = String(row['Nome centro de custo'] || '').trim();
      let projetoResolvido = rawNome || rawCodigo || 'SEM PROJETO';
      let projetoResolvidoPor = 'CENTRO_CUSTO';
      let projetoCodigoValidado = '';

      if (rawCodigo && rawNome === '') {
        const found = sheetData.find(r =>
          String(r['Código centro de custo'] || '').trim() === rawCodigo
          && String(r['Nome centro de custo'] || '').trim() !== ''
        );
        projetoResolvido = found ? String(found['Nome centro de custo']).trim() : rawCodigo;
      }

      const centroCustoGenerico = isCR
        && rawCodigo === '1'
        && normalizeText(rawNome) === 'GRUPO OAE';

      if (centroCustoGenerico || (isCR && (!rawNome || normalizeText(rawNome) === 'SEM PROJETO'))) {
        const validatedProject = resolveProjectFromDocument(row.Documento, projectIndex);
        if (validatedProject) {
          projetoResolvido = validatedProject.label;
          projetoCodigoValidado = validatedProject.code;
          projetoResolvidoPor = 'DOCUMENTO_VALIDADO_PROJETOS_2026';
        } else {
          projetoResolvidoPor = 'CENTRO_CUSTO_GENERICO_NAO_RESOLVIDO';
        }
      }

      const contaRaw = String(row.Conta || '').trim();
      const contaDashIdx = contaRaw.indexOf(' - ');
      const contaNomeOriginal = contaDashIdx >= 0
        ? contaRaw.slice(contaDashIdx + 3).trim()
        : contaRaw;

      const dataEmissao = String(
        row['Data de Emissão']
        || row['Data de emissão']
        || row['Data Emissão']
        || row['Data emissão']
        || ''
      ).trim();

      return {
        natureza: nature,
        data: row.Data,
        dataEmissao,
        documento: String(row.Documento || ''),
        status: String(row.Status || '').trim(),
        projeto: projetoResolvido,
        projetoCodigoOriginal: rawCodigo,
        projetoNomeOriginal: rawNome,
        projetoResolvidoPor,
        projetoCodigoValidado,
        centroCustoGenerico,
        origemSienge: String(row.Origem || '').trim(),
        nome: String(row.Nome || '').trim(),
        valor: parseBRL(row.Valor),
        lancamento: String(row['Lançamento'] || row['Lanamento'] || '').trim(),
        valorTotalTitulo: parseBRL(row['Valor total título'] || row['Valor total ttulo']),
        contaCodigo: accountCode,
        contaNome: contaNomeOriginal,
        contaDescricao: dreInfo['DESCRIÇÃO DRE'],
        dreClasse: dreInfo['Classe Orçamentária'],
        drePacote: dreInfo['Pacote'],
        dreLinha: dreInfo['Linha DRE']
      };
    });
}
