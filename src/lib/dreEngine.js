import { isTeamExpense } from '@/lib/financialClassification';

/**
 * dreEngine.js — Motor da DRE Gerencial OAE_FIN V2
 *
 * Responsável por:
 * - Definir a ordem e tipos dos grupos da DRE
 * - Construir a estrutura hierárquica de dados por mês
 * - Calcular linhas de resultado derivadas
 * - Aplicar regra especial de receita ADM vinculada por projeto
 */

// ─── Ordem canônica dos grupos na DRE ───────────────────────────────────────
// Os NOMES são usados para match com o campo dreClasse do DEPARA.
// tipo: 'receita' | 'deducao' | 'resultado' | 'custo' | 'despesa' | 'outra_receita' | 'despesa_fin' | 'deducao_fiscal' | 'resultado_final' | 'nao_class'
export const DRE_ORDER = [
  { id: 'RECEITA_BRUTA',    tipo: 'receita',          label: '01 · RECEITA BRUTA',                      sign: +1 },
  { id: 'DED_RECEITA',      tipo: 'deducao',          label: '02 · (-) DEDUÇÕES DA RECEITA',            sign: -1 },
  { id: 'REC_LIQUIDA',      tipo: 'resultado',        label: '03 · (=) RECEITA LÍQUIDA',                computed: true, deps: ['RECEITA_BRUTA','DED_RECEITA'] },
  { id: 'CUSTOS_SERVICOS',  tipo: 'custo',            label: '04 · (-) CUSTOS DOS SERVIÇOS / CUSTOS DIRETOS', sign: -1 },
  { id: 'DESP_ADM',         tipo: 'despesa',          label: '05 · (-) DESPESAS ADMINISTRATIVAS',       sign: -1 },
  { id: 'DESP_COMERCIAL',   tipo: 'despesa',          label: '06 · (-) COMERCIAL E MARKETING',          sign: -1 },
  { id: 'RES_OPERACIONAL',  tipo: 'resultado',        label: '07 · (=) RESULTADO OPERACIONAL',         computed: true, deps: ['REC_LIQUIDA','CUSTOS_SERVICOS','DESP_ADM','DESP_COMERCIAL'] },
  { id: 'OUTRA_RECEITA',    tipo: 'outra_receita',    label: '08 · (+) OUTRAS RECEITAS / RECUPERAÇÕES',     sign: +1 },
  { id: 'RES_FINANCEIRO',   tipo: 'resultado_financeiro', label: '09 · (+/-) RESULTADO FINANCEIRO',     isCompound: true, subGroups: ['REC_FINANCEIRA', 'DESP_FINANCEIRA'], computed: true, deps: ['REC_FINANCEIRA', 'DESP_FINANCEIRA'] },
  { id: 'REC_FINANCEIRA',   tipo: 'receita_fin',      label: 'Receitas Financeiras',               sign: +1, hidden: true },
  { id: 'DESP_FINANCEIRA',  tipo: 'despesa_fin',      label: 'Despesas Financeiras',               sign: -1, hidden: true },
  { id: 'RES_ANTES_IR',     tipo: 'resultado',        label: '10 · (=) RESULTADO ANTES DE IRPJ E CSLL', computed: true, deps: ['RES_OPERACIONAL','OUTRA_RECEITA','RES_FINANCEIRO'] },
  { id: 'DED_FISCAL',       tipo: 'deducao_fiscal',   label: '11 · (-) IRPJ / CSLL',                    sign: -1 },
  { id: 'RES_LIQUIDO',      tipo: 'resultado_final',  label: '12 · (=) RESULTADO LÍQUIDO',              computed: true, deps: ['RES_ANTES_IR','DED_FISCAL'] },
];

const CLASS_MAP = [
  { id: 'RECEITA_BRUTA',   keywords: ['RECEITA BRUTA', 'RECEITA OPERACIONAL'] },
  { id: 'DED_RECEITA',     keywords: ['DEDUÇ', 'DEDUC', 'IMPOSTOS SOBRE RECEITA'] },
  { id: 'CUSTOS_SERVICOS', keywords: ['CUSTOS DOS SERVIÇOS', 'CUSTO DIRETO', 'CUSTO OPERACIONAL', 'EQUIPE TÉCNICA', 'EQUIPE TECNICA', 'CUSTOS / PROJETOS', 'CUSTO PROJETO'] },
  { id: 'DESP_ADM',        keywords: ['DESPESAS ADMINISTRATIVAS', 'DESP ADM', 'DESP. ADM', 'ASSESSORIA', 'SERVIÇOS TERCEIROS', 'SERVICOS TERCEIROS', 'TECNOLOGIA', 'SISTEMAS'] },
  { id: 'DESP_COMERCIAL',  keywords: ['COMERCIAL E MARKETING', 'COMERCIAL', 'MARKETING'] },
  { id: 'OUTRA_RECEITA',   keywords: ['OUTRAS RECEITAS', 'RECUPERAÇÃO', 'RECUPERACAO'] },
  { id: 'REC_FINANCEIRA',  keywords: ['RECEITA FINANCEIRA', 'RENDIMENTO', 'ACRÉSCIMO RECEBIDO'] },
  { id: 'DESP_FINANCEIRA', keywords: ['DESPESA FINANCEIRA', 'FINANCEIRO', 'JUROS', 'MULTA', 'IOF', 'TARIFA'] },
  { id: 'DED_FISCAL',      keywords: ['IRPJ', 'CSLL', 'FISCAL'] },
];

export function mapClasseToDreId(item) {
  const dreClasse = item.dreClasseLabel || item.dreClasse || '';
  const dreLinha = item.dreLinhaLabel || item.dreLinha || '';
  const projeto = String(item.projeto || '').toUpperCase();

  // Equipe vinculada ao centro de custo administrativo é despesa administrativa,
  // nunca custo direto de projeto.
  if (item.natureza === 'Saída' && projeto.includes('ADMINISTRA') && isTeamExpense(item)) return 'DESP_ADM';

  if (dreClasse.includes('PENDENTE') || dreLinha.includes('PENDENTE')) return null;

  const upperClasse = dreClasse.toUpperCase();
  const upperLinha = dreLinha.toUpperCase();

  for (const { id, keywords } of CLASS_MAP) {
    if (keywords.some(k => upperClasse.includes(k) || upperLinha.includes(k))) return id;
  }
  return null; // Não classificado
}

// ─── Construção dos meses do período ─────────────────────────────────────────
export function buildMeses(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal) return [];
  const start = new Date(dataInicial + 'T00:00:00');
  const end = new Date(dataFinal + 'T23:59:59');
  const meses = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    meses.push({
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
      label: cur.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(' de ', '/'),
      year: cur.getFullYear(),
      month: cur.getMonth(),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return meses;
}

// ─── Motor principal ──────────────────────────────────────────────────────────
export function buildDreStructure(items, meses) {
  // Estrutura: { [dreId]: { label, accounts: { [linhaKey]: { label, items, byMonth: {key: val} } }, byMonth: {key: val}, total } }
  const groups = {};
  const naoClassificados = { items: [], byMonth: {}, total: 0 };

  // Inicializar grupos
  DRE_ORDER.filter(g => !g.computed).forEach(g => {
    groups[g.id] = {
      ...g,
      accounts: {},
      byMonth: {},
      total: 0,
      itemCount: 0,
    };
    meses.forEach(m => groups[g.id].byMonth[m.key] = 0);
  });
  meses.forEach(m => naoClassificados.byMonth[m.key] = 0);

  items.forEach(item => {
    const dreId = mapClasseToDreId(item);
    const mesKey = item.mesKey;
    const valorCru = Math.abs(item.valor || 0); // Sempre absoluto — o sinal vem de group.sign

    // NÍVEL 2: Nome real da conta do lançamento (ex: PIS, COFINS, ISS, TARIFAS)
    const linhaKey = item.contaNome || item.contaDescricao || 'Sem descrição';

    if (!dreId) {
      naoClassificados.items.push(item);
      naoClassificados.total += valorCru;
      if (mesKey && naoClassificados.byMonth[mesKey] !== undefined) {
        naoClassificados.byMonth[mesKey] += valorCru;
      }
      return;
    }

    const group = groups[dreId];
    if (!group) return;

    // magnitude = valor absoluto × sinal do grupo
    // sign=+1 (receitas) → magnitude positiva
    // sign=-1 (custos/deduções/despesas) → magnitude negativa
    // O total do grupo JÁ TEM O SINAL EMBUTIDO — não multiplicar novamente no computed.
    const magnitude = valorCru * (group.sign || 1);

    group.total += magnitude;
    group.itemCount++;
    if (mesKey && group.byMonth[mesKey] !== undefined) {
      group.byMonth[mesKey] += magnitude;
    }

    if (!group.accounts[linhaKey]) {
      group.accounts[linhaKey] = { label: linhaKey, items: [], byMonth: {}, total: 0 };
      meses.forEach(m => group.accounts[linhaKey].byMonth[m.key] = 0);
    }
    group.accounts[linhaKey].items.push(item);
    group.accounts[linhaKey].total += magnitude;
    if (mesKey && group.accounts[linhaKey].byMonth[mesKey] !== undefined) {
      group.accounts[linhaKey].byMonth[mesKey] += magnitude;
    }
  });

  // Calcular linhas de resultado
  const totals = {};
  DRE_ORDER.forEach(g => { if (!g.computed) totals[g.id] = groups[g.id]?.total || 0; });

  // Calcular computed em ordem
  // IMPORTANTE: depGroup.total JÁ tem o sinal embutido (magnitude = abs × sign).
  // Portanto NÃO multiplicar por sign novamente — apenas somar diretamente.
  const computedValues = {};
  const computedByMonth = {};

  DRE_ORDER.filter(g => g.computed).forEach(g => {
    let val = 0;
    const byMonth = {};
    meses.forEach(m => byMonth[m.key] = 0);

    g.deps.forEach(depId => {
      const depDef = DRE_ORDER.find(x => x.id === depId);
      if (!depDef) return;

      if (depDef.computed) {
        val += computedValues[depId] || 0;
        meses.forEach(m => { byMonth[m.key] += (computedByMonth[depId]?.[m.key] || 0); });
      } else {
        const depGroup = groups[depId];
        if (!depGroup) return;
        // Sinal já embutido no total — soma direta
        val += depGroup.total || 0;
        meses.forEach(m => { byMonth[m.key] += depGroup.byMonth[m.key] || 0; });
      }
    });

    computedValues[g.id] = val;
    computedByMonth[g.id] = byMonth;
  });

  return { groups, naoClassificados, computedValues, computedByMonth };
}

// ─── Aplicar mesKey aos itens ─────────────────────────────────────────────────
export function tagItemsWithMesKey(items) {
  return items.map(item => {
    let mesKey = null;
    if (item.data) {
      const parts = String(item.data).trim().split('/');
      if (parts.length === 3) {
        mesKey = `${parts[2]}-${parts[1].padStart(2, '0')}`;
      }
    }
    return { ...item, mesKey };
  });
}

// ─── Filtrar itens para DRE ───────────────────────────────────────────────────
export function filterDreItems(baseData, {
  filterDataInicial, filterDataFinal,
  filterProjetos, filterEmpresas,
  filterCCs,
  visao = 'REALIZADO' // 'REALIZADO', 'SOMENTE_PREVISAO', 'REALIZADO_PREVISAO'
}) {
  const dIni = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
  const dFim = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;

  // Data de corte = Início do dia de hoje
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeTs = hoje.getTime();
  const endOf2026 = new Date('2026-12-31T23:59:59').getTime();

  return baseData.filter(item => {
    // Verificar status
    const statusUpper = String(item.status || '').toUpperCase();
    const isRealizado = statusUpper.includes('REALIZADO') || statusUpper.includes('PAGO') || statusUpper.includes('RECEBIDO') || statusUpper === 'EFETIVADO';
    const isPrevisto = !isRealizado && (statusUpper.includes('A REALIZAR') || statusUpper.includes('A RECEBER') || statusUpper.includes('A PAGAR') || statusUpper.includes('PREVISTO'));

    const ts = item.dataTimestamp || 0;

    // Lógica da visão
    if (visao === 'REALIZADO') {
      if (!isRealizado) return false;
    } else if (visao === 'SOMENTE_PREVISAO') {
      if (!isPrevisto) return false;
      if (ts < hojeTs || ts > endOf2026) return false;
    } else if (visao === 'REALIZADO_PREVISAO') {
      if (isRealizado) {
        // Se for realizado, só considera até a data de hoje (para evitar incluir "realizados" com data futura se existir erro na base, embora improvável, o usuário pediu "lançamentos até a data atual")
        // Na verdade, o seguro é incluir todos os realizados até hoje.
        if (ts > hojeTs) return false; // Ignora realizados com data no futuro? Apenas por segurança.
      } else if (isPrevisto) {
        if (ts < hojeTs || ts > endOf2026) return false;
      } else {
        return false; // Status desconhecido
      }
    }

    // Filtro para "Fora da DRE" ou "Não Incluir" com base na Classe ou Linha
    const dreClasseUpper = String(item.dreClasse || '').toUpperCase();
    const dreLinhaUpper = String(item.dreLinha || '').toUpperCase();
    if (dreClasseUpper.includes('FORA DA DRE') || dreClasseUpper.includes('NÃO INCLUIR') || dreClasseUpper.includes('NAO INCLUIR') || dreClasseUpper.includes('PATRIMONIAL') || dreClasseUpper.includes('FINANCIAMENTO') || dreClasseUpper.includes('APORTE') || dreClasseUpper.includes('CAPEX')) {
      return false;
    }
    if (dreLinhaUpper.includes('FORA DA DRE') || dreLinhaUpper.includes('NÃO INCLUIR') || dreLinhaUpper.includes('NAO INCLUIR') || dreLinhaUpper.includes('PATRIMONIAL')) {
      return false;
    }

    const tsFilter = item.dataTimestamp || 0;
    if (tsFilter < dIni || tsFilter > dFim) return false;
    if (filterEmpresas?.length > 0 && !filterEmpresas.includes(item.empresa)) return false;
    if (filterCCs?.length > 0 && !filterCCs.includes(item.projeto)) return false;
    if (filterProjetos?.length > 0 && !filterProjetos.includes(item.projeto)) return false;
    return true;
  });
}
