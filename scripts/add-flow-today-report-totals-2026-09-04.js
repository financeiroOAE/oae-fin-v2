const fs = require('fs');

const pagePath = 'src/app/fluxo-caixa/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

const before = `  const reportResumoHojeRows = useMemo(() => ([\n    ...receitasDoDia.map((item) => ({\n      Situação: 'A Receber',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n    ...compromissosDoDia.map((item) => ({\n      Situação: 'A Pagar',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n  ]), [receitasDoDia, compromissosDoDia]);`;

const after = `  const reportResumoHojeRows = useMemo(() => ([\n    ...receitasDoDia.map((item) => ({\n      Situação: 'A Receber',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n    ...(receitasDoDia.length > 0 ? [{\n      Situação: 'TOTAL A RECEBER',\n      Data: '-',\n      Documento: '-',\n      Nome: 'TOTAL DA RELAÇÃO DE RECEBIMENTOS',\n      Projeto: '-',\n      Conta: '-',\n      Valor: totalReceitasDia,\n    }] : []),\n    ...compromissosDoDia.map((item) => ({\n      Situação: 'A Pagar',\n      Data: item.data,\n      Documento: item.documento || item.lancamento || '-',\n      Nome: item.nome || '-',\n      Projeto: item.projeto || '-',\n      Conta: item.contaDescricao || '-',\n      Valor: Number(item.valor) || 0,\n    })),\n    ...(compromissosDoDia.length > 0 ? [{\n      Situação: 'TOTAL A PAGAR',\n      Data: '-',\n      Documento: '-',\n      Nome: 'TOTAL DA RELAÇÃO DE PAGAMENTOS',\n      Projeto: '-',\n      Conta: '-',\n      Valor: totalCompromissosDia,\n    }] : []),\n  ]), [receitasDoDia, compromissosDoDia, totalReceitasDia, totalCompromissosDia]);`;

page = replaceOnce(page, before, after, 'linhas e totalizadores do Resumo de Hoje');

page = replaceOnce(
  page,
  `              explanation="Detalhamento dos lançamentos previstos para o dia, separando contas a receber e contas a pagar."`,
  `              explanation="Detalhamento dos lançamentos previstos para o dia, separando contas a receber e contas a pagar, com total da relação ao final de cada grupo."`,
  'explicacao do Resumo de Hoje'
);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Resumo de Hoje atualizado com TOTAL A RECEBER e TOTAL A PAGAR no relatorio.');
