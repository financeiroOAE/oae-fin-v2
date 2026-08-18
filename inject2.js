const fs = require('fs');

let content = fs.readFileSync('src/app/projetos/page.js', 'utf8');

const replaces = [
  {
    find: '<InfoTooltip title="5 Maiores Entradas" content={<><p>Exibe os 5 projetos com maior total de movimentações de <strong>Entrada</strong>',
    adder: `<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder title="5 Maiores Entradas de Caixa" componentName="Gráfico Maiores Entradas" page="Projetos" type="TABLE" data={topEntradasData} filters={\`Projetos: \${filterProjetos.length}\`} />
              `
  },
  {
    find: '<InfoTooltip title="5 Maiores Saídas" content={<><p>Exibe os 5 projetos com maior total de movimentações de <strong>Saída</strong>',
    adder: `<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder title="5 Maiores Saídas de Caixa" componentName="Gráfico Maiores Saídas" page="Projetos" type="TABLE" data={topSaidasData} filters={\`Projetos: \${filterProjetos.length}\`} />
              `
  },
  {
    find: '<InfoTooltip title="Impostos sobre Notas Fiscais" content={<><p>Mostra os tributos e retenções',
    adder: `<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder title="Impostos sobre Faturamento" componentName="Gráfico Impostos" page="Projetos" type="TABLE" data={taxesData.list} filters={\`Projetos: \${filterProjetos.length}\`} />
              `
  }
];

replaces.forEach(r => {
  if (content.includes(r.find) && !content.includes(r.adder)) {
    content = content.replace(r.find, r.adder + r.find + '</div>');
  }
});

const relExecFind = '<span style={{ fontSize: \'12px\', color: \'var(--text-secondary)\' }}>\n          Mostrando {paginatedProjetos.length}';
const relExecAdder = `<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ReportAdder title="Relatório Executivo de Projetos" componentName="Tabela de Projetos" page="Projetos" type="TABLE" data={sortedProjetos.map(p => ({ Projeto: p.nome, Empresa: p.empresa, Contratado: p.contratado, Faturado: p.faturado, Saldo: p.saldoContratual, Recebido: p.recebido, Pago: p.pago, Resultado: p.resultadoCaixa }))} filters={\`Projetos visíveis: \${paginatedProjetos.length}\`} />
          `;
if (content.includes(relExecFind) && !content.includes('Tabela de Projetos')) {
  content = content.replace(relExecFind, relExecAdder + relExecFind + '</div>');
}

fs.writeFileSync('src/app/projetos/page.js', content);
