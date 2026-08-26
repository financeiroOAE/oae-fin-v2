const fs = require('fs');

function mustReplace(content, oldText, newText, label) {
  if (!content.includes(oldText)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(oldText, newText);
}

// 1) Consolidacao: K entra uma unica vez por titulo realizado.
const consolidationPath = 'src/lib/consolidation.js';
let consolidation = fs.readFileSync(consolidationPath, 'utf8');

const marker = `  const processedConsolidated = Array.from(consolidatedMap.values()).map(cons => {`;
const allocationBlock = `  // Para entradas realizadas, a coluna K representa o liquido do titulo.
  // Quando Projeto e ADM repetem o mesmo K no mesmo titulo, o caixa nao pode
  // ser somado duas vezes. Mantemos um unico liquido e distribuimos entre
  // Projeto/ADM conforme a composicao do titulo (coluna J como peso).
  if (usarValorCaixa) {
    consolidatedMap.forEach((cons) => {
      const status = String(cons.status || '').trim().toUpperCase();
      const isRealizado = status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO');
      if (!isRealizado || !Array.isArray(cons.linhasOriginais) || cons.linhasOriginais.length === 0) return;

      const revenueRows = cons.linhasOriginais
        .map((row) => ({ row, classification: classifyFinancialEntry(row) }))
        .filter(({ classification }) => classification.type === 'receita_projeto' || classification.type === 'receita_administrativa');
      if (revenueRows.length === 0) return;

      const liquidValues = revenueRows.map(({ row }) => Number(row.valorCaixa ?? row.valor) || 0);
      const nonZero = liquidValues.filter((value) => Math.abs(value) > 0.000001);
      if (nonZero.length === 0) return;

      const firstRounded = Math.round(nonZero[0] * 100) / 100;
      const allSame = nonZero.every((value) => Math.round(value * 100) / 100 === firstRounded);
      const titleLiquid = allSame
        ? firstRounded
        : Math.round(nonZero.reduce((sum, value) => sum + value, 0) * 100) / 100;

      const weighted = revenueRows.map(({ row, classification }) => {
        const faturamento = Math.abs(Number(row.valorFaturamento ?? row.valorTotalTitulo) || 0);
        const fallback = Math.abs(Number(row.valorCaixa ?? row.valor) || 0);
        return { classification, weight: faturamento > 0 ? faturamento : fallback };
      });
      const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) return;

      const directWeight = weighted
        .filter((item) => item.classification.type === 'receita_projeto')
        .reduce((sum, item) => sum + item.weight, 0);
      const admWeight = weighted
        .filter((item) => item.classification.type === 'receita_administrativa')
        .reduce((sum, item) => sum + item.weight, 0);

      const directValue = Math.round((titleLiquid * (directWeight / totalWeight)) * 100) / 100;
      const admValue = Math.round((titleLiquid - directValue) * 100) / 100;

      cons.valorDireto = directValue;
      cons.valorAdministrativo = admWeight > 0 ? admValue : 0;
      cons.valorLiquidoTitulo = titleLiquid;
      cons.liquidoConsolidadoPorTitulo = revenueRows.length > 1;
    });
  }

${marker}`;

if (!consolidation.includes('liquidoConsolidadoPorTitulo')) {
  consolidation = mustReplace(consolidation, marker, allocationBlock, 'inserir deduplicacao K por titulo');
}
fs.writeFileSync(consolidationPath, consolidation);

// 2) Projetos: todos os totais e graficos usam a mesma base consolidada,
// controlada pelo checkbox de rateio administrativo.
const projectsPath = 'src/app/projetos/page.js';
let projects = fs.readFileSync(projectsPath, 'utf8');

projects = projects.replaceAll('projectCashData', 'baseData');

const oldMonthly = `    const revenueItems = usarCarteiraCompleta ? data : baseData;
    revenueItems.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      if (!usarCarteiraCompleta && !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      const originalRows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const revenue = originalRows.reduce((sum, row) => {
        const code = String(row.contaCodigo || '').replace(/\\D/g, '');
        return (code === '1010101' || code === '1010107') ? sum + (Number(row.valorCaixa ?? row.valor) || 0) : sum;
      }, 0);
      rows[month].Receitas += revenue;
    });`;

const newMonthly = `    const revenueItems = baseData;
    revenueItems.forEach((item) => {
      if (item.natureza !== 'Entrada') return;
      if (!usarCarteiraCompleta && !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      rows[month].Receitas += Number(item.valor) || 0;
    });`;

if (projects.includes(oldMonthly)) {
  projects = projects.replace(oldMonthly, newMonthly);
}

// Garantia: nenhuma referencia a variaveis removidas pode sobreviver.
if (projects.includes('projectCashData')) throw new Error('Referencia residual projectCashData');
if (projects.includes('rawProjectRevenueStats')) throw new Error('Referencia residual rawProjectRevenueStats');

fs.writeFileSync(projectsPath, projects);

console.log('Correcao estavel aplicada: K unico por titulo, ADM condicional e graficos consolidados.');
