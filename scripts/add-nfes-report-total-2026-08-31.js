const fs = require('fs');

const pagePath = 'src/app/fluxo-caixa/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const totalsBefore = [
  "  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);",
  "  const totalValorRealNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorRealNota) || 0), 0);"
].join('\n');

const totalsAfter = [
  "  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);",
  "  const totalValorRealNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorRealNota) || 0), 0);",
  "",
  "  const reportFaturamentosNfesRows = useMemo(() => [",
  "    ...faturamentosNfesFiltrados.map((row) => ({",
  "      Documento: row.documento,",
  "      Projeto: row.projeto,",
  "      Vencimento: row.data,",
  "      \"Valor Bruto\": Number(row.valorRealNota) || 0,",
  "      \"Valor Líquido\": Number(row.valor) || 0,",
  "    })),",
  "    ...(faturamentosNfesFiltrados.length > 0 ? [{",
  "      Documento: 'TOTAL DAS NOTAS',",
  "      Projeto: '-',",
  "      Vencimento: '-',",
  "      \"Valor Bruto\": totalValorRealNfes,",
  "      \"Valor Líquido\": totalFaturamentosNfes,",
  "    }] : []),",
  "  ], [faturamentosNfesFiltrados, totalValorRealNfes, totalFaturamentosNfes]);",
  "",
  "  const reportFaturamentosNfesSummary = useMemo(() => [{",
  "    \"Quantidade de Notas\": faturamentosNfesFiltrados.length,",
  "    \"Total das Notas\": totalValorRealNfes,",
  "    \"Total Líquido\": totalFaturamentosNfes,",
  "  }], [faturamentosNfesFiltrados.length, totalValorRealNfes, totalFaturamentosNfes]);"
].join('\n');

if (!page.includes(totalsBefore)) {
  throw new Error('Trecho de totais do faturamento NFES nao encontrado.');
}
page = page.replace(totalsBefore, totalsAfter);

const adderBefore = '            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Vencimento: row.data, "Valor Bruto": row.valorRealNota, "Valor Líquido": row.valor }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: \'right\' }} />';

const adderAfter = [
  '            <ReportAdder',
  '              sectionKey="fluxo:faturamento-nfes"',
  '              title="Painel de Faturamento (NFES)"',
  '              componentName="Tabela de Faturamentos"',
  '              page="Fluxo de Caixa"',
  '              type="TABLE"',
  '              data={reportFaturamentosNfesRows}',
  '              dataSets={{ all: reportFaturamentosNfesRows, summary: reportFaturamentosNfesSummary }}',
  '              detailMode="all"',
  '              detailOptions={["all", "summary"]}',
  '              filters={{ Tipo: "NFES", Situação: "A receber" }}',
  '              explanation="Relação de notas fiscais faturadas com soma total do valor bruto e do valor líquido."',
  '              style={{ float: \'right\' }}',
  '            />'
].join('\n');

if (!page.includes(adderBefore)) {
  throw new Error('ReportAdder do faturamento NFES nao encontrado.');
}
page = page.replace(adderBefore, adderAfter);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Total das notas incluido na relacao de faturamento do relatorio.');
