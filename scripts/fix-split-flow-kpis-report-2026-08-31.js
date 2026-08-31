const fs = require('fs');

const pagePath = 'src/app/fluxo-caixa/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

function replaceOnce(before, after, label) {
  if (!page.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  page = page.replace(before, after);
}

replaceOnce(
  '          <ReportAdder sectionKey="fluxo:kpis" title="Resumo Executivo do Fluxo de Caixa" componentName="Indicadores do Fluxo de Caixa" page="Fluxo de Caixa" type="SUMMARY" data={[{ "Saldo Bancário": totalBancario, Entradas: totalEntradas, Saídas: totalSaidas, Resultado: resultadoTotal, "A Receber": entradasARealizar, "A Pagar": saidasARealizar }]} filters={reportFilters} presetTags={["executive-financial"]} explanation="Resumo de saldos, entradas, saídas e compromissos conforme os filtros ativos." style={{ float: \'right\' }} />',
  '          <ReportAdder sectionKey="fluxo:kpi-saldo-bancario" title="Resumo Executivo — Saldo Bancário" componentName="Indicador Saldo Bancário" page="Fluxo de Caixa" type="SUMMARY" data={[{ "Saldo Bancário": totalBancario }]} filters={reportFilters} presetTags={["executive-financial"]} explanation="Saldo bancário consolidado para a posição disponível." style={{ float: \'right\' }} />',
  'ReportAdder saldo bancario'
);

replaceOnce(
  [
    "        <div className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--success)' }}>",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Entradas Realizadas</p>"
  ].join('\n'),
  [
    "        <div className=\"card\" data-report-section style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--success)' }}>",
    "          <ReportAdder sectionKey=\"fluxo:kpi-entradas\" title=\"Resumo Executivo — Entradas Realizadas\" componentName=\"Indicador Entradas Realizadas\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ \"Entradas Realizadas\": totalEntradas }]} filters={reportFilters} presetTags={[\"executive-financial\"]} explanation=\"Entradas líquidas efetivamente recebidas no período filtrado.\" style={{ float: 'right' }} />",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Entradas Realizadas</p>"
  ].join('\n'),
  'card Entradas Realizadas'
);

replaceOnce(
  [
    "        <div className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--danger)' }}>",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Saídas</p>"
  ].join('\n'),
  [
    "        <div className=\"card\" data-report-section style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--danger)' }}>",
    "          <ReportAdder sectionKey=\"fluxo:kpi-saidas\" title=\"Resumo Executivo — Saídas\" componentName=\"Indicador Saídas\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ Saídas: totalSaidas }]} filters={reportFilters} presetTags={[\"executive-financial\"]} explanation=\"Saídas efetivamente pagas no período filtrado.\" style={{ float: 'right' }} />",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Saídas</p>"
  ].join('\n'),
  'card Saidas'
);

replaceOnce(
  [
    "        <div className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: `4px solid ${resultadoTotal >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Resultado</p>"
  ].join('\n'),
  [
    "        <div className=\"card\" data-report-section style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: `4px solid ${resultadoTotal >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>",
    "          <ReportAdder sectionKey=\"fluxo:kpi-resultado\" title=\"Resumo Executivo — Resultado\" componentName=\"Indicador Resultado\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ Resultado: resultadoTotal }]} filters={reportFilters} presetTags={[\"executive-financial\"]} explanation=\"Resultado do período: entradas realizadas menos saídas realizadas.\" style={{ float: 'right' }} />",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Resultado</p>"
  ].join('\n'),
  'card Resultado'
);

replaceOnce(
  [
    "        <div className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--warning)' }}>",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Receber</p>"
  ].join('\n'),
  [
    "        <div className=\"card\" data-report-section style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--warning)' }}>",
    "          <ReportAdder sectionKey=\"fluxo:kpi-a-receber\" title=\"Resumo Executivo — A Receber\" componentName=\"Indicador A Receber\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ \"A Receber\": entradasARealizar }]} filters={reportFilters} presetTags={[\"executive-financial\"]} explanation=\"Valores previstos a receber dentro do período filtrado.\" style={{ float: 'right' }} />",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Receber</p>"
  ].join('\n'),
  'card A Receber'
);

replaceOnce(
  [
    "        <div className=\"card\" style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--orange)' }}>",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Pagar</p>"
  ].join('\n'),
  [
    "        <div className=\"card\" data-report-section style={{ padding: '1.25rem', height: '100%', minWidth: 0, borderLeft: '4px solid var(--orange)' }}>",
    "          <ReportAdder sectionKey=\"fluxo:kpi-a-pagar\" title=\"Resumo Executivo — A Pagar\" componentName=\"Indicador A Pagar\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ \"A Pagar\": saidasARealizar }]} filters={reportFilters} presetTags={[\"executive-financial\"]} explanation=\"Valores previstos a pagar dentro do período filtrado.\" style={{ float: 'right' }} />",
    "          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>",
    "            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>A Pagar</p>"
  ].join('\n'),
  'card A Pagar'
);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Selecao individual dos seis KPIs do Fluxo de Caixa aplicada.');
