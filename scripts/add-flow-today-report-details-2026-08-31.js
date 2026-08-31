const fs = require('fs');

const pagePath = 'src/app/fluxo-caixa/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

page = replaceOnce(
  page,
  `  const totalReceitasDia = receitasDoDia.reduce((acc, curr) => acc + curr.valor, 0);\n  const totalCompromissosDia = compromissosDoDia.reduce((acc, curr) => acc + curr.valor, 0);\n\n  const formatDateBR = (d) => \`${'${String(d.getDate()).padStart(2, \'0\')}/${String(d.getMonth() + 1).padStart(2, \'0\')}/${d.getFullYear()}'}\`;`,
  `  const totalReceitasDia = receitasDoDia.reduce((acc, curr) => acc + curr.valor, 0);\n  const totalCompromissosDia = compromissosDoDia.reduce((acc, curr) => acc + curr.valor, 0);\n\n  const reportResumoHojeSummary = useMemo(() => ([{\n    \"A Receber Hoje\": totalReceitasDia,\n    \"Lançamentos a Receber\": receitasDoDia.length,\n    \"A Pagar Hoje\": totalCompromissosDia,\n    \"Lançamentos a Pagar\": compromissosDoDia.length,\n  }]), [totalReceitasDia, receitasDoDia.length, totalCompromissosDia, compromissosDoDia.length]);\n\n  const reportResumoHojeRows = useMemo(() => ([\n    ...receitasDoDia.map((item) => ({\n      Situação: 'A Receber',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n    ...compromissosDoDia.map((item) => ({\n      Situação: 'A Pagar',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n  ]), [receitasDoDia, compromissosDoDia]);\n\n  const formatDateBR = (d) => \`${'${String(d.getDate()).padStart(2, \'0\')}/${String(d.getMonth() + 1).padStart(2, \'0\')}/${d.getFullYear()}'}\`;`,
  'dados estruturados do resumo diario'
);

page = replaceOnce(
  page,
  `            <ReportAdder sectionKey=\"fluxo:resumo-hoje\" title={\`Resumo de Hoje — ${'${formatDateBR(hojeObj)}'}\`} componentName=\"Resumo de Hoje\" page=\"Fluxo de Caixa\" type=\"SUMMARY\" data={[{ \"A Receber Hoje\": totalReceitasDia, \"Lançamentos a Receber\": receitasDoDia.length, \"A Pagar Hoje\": totalCompromissosDia, \"Lançamentos a Pagar\": compromissosDoDia.length }]} filters={{ Data: formatDateBR(hojeObj) }} style={{ alignSelf: 'flex-end' }} />`,
  `            <ReportAdder\n              sectionKey=\"fluxo:resumo-hoje\"\n              title={\`Resumo de Hoje — ${'${formatDateBR(hojeObj)}'}\`}\n              componentName=\"Resumo de Hoje\"\n              page=\"Fluxo de Caixa\"\n              type=\"TABLE\"\n              data={reportResumoHojeRows}\n              dataSets={{ summary: reportResumoHojeSummary, all: reportResumoHojeRows }}\n              detailMode=\"all\"\n              detailOptions={[\"all\", \"summary\"]}\n              filters={{ Data: formatDateBR(hojeObj) }}\n              explanation=\"Detalhamento dos lançamentos previstos para o dia, separando contas a receber e contas a pagar.\"\n              style={{ alignSelf: 'flex-end' }}\n            />`,
  'ReportAdder do resumo diario'
);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Resumo diario do Fluxo de Caixa preparado com lancamentos detalhados no relatorio.');
