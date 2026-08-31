const fs = require('fs');
const path = 'src/app/visao-financeira/page.js';
let content = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  content = content.replace(before, after);
}

replaceOnce(
`  // Receita de projetos: a fonte de verdade e a conta da CR_GERAL.\n  // 1010101 = faturamento e 1010107 = administrativo. Nao dependemos do\n  // cadastro de projetos ativos para decidir se uma receita existe.\n  const projectRevenueStatus = useMemo(() => {\n    const accumulate = (items) => {\n      let obra = 0;\n      let adm = 0;\n      items.forEach((item) => {\n        if (item.natureza !== 'Entrada') return;\n        const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];\n        rows.forEach((row) => {\n          const code = String(row.contaCodigo || '').replace(/\\D/g, '');\n          const value = Number(row.valor) || 0;\n          if (code === '1010101') obra += value;\n          if (code === '1010107') adm += value;\n        });\n      });\n      return { obra, adm, total: obra + adm };\n    };\n\n    return {\n      realizado: accumulate(realizedFilteredData),\n      pendente: accumulate(forecastFilteredData),\n    };\n  }, [realizedFilteredData, forecastFilteredData]);`,
`  // Projeto x Administrativo e calculado pelo sistema em 80/20.\n  // REC. FATURAMENTO e REC. ADMINISTRATIVO identificam o recebimento,\n  // mas nao determinam mais a divisao dos valores.\n  const projectRevenueStatus = useMemo(() => {\n    const accumulate = (items) => items.reduce((totals, item) => {\n      if (item.natureza !== 'Entrada') return totals;\n      const total = Number(item.valorReceitaProjetoTotal) || 0;\n      if (!total) return totals;\n      totals.obra += Number(item.valorDireto) || 0;\n      totals.adm += Number(item.valorAdministrativo) || 0;\n      totals.total += total;\n      return totals;\n    }, { obra: 0, adm: 0, total: 0 });\n\n    return {\n      realizado: accumulate(realizedFilteredData),\n      pendente: accumulate(forecastFilteredData),\n    };\n  }, [realizedFilteredData, forecastFilteredData]);`,
'projectRevenueStatus'
);

replaceOnce(
`    realizedFilteredData.forEach((item) => {\n      if (item.natureza !== 'Entrada') return;\n      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];\n      rows.forEach((row) => {\n        const value = Number(row.valor) || 0;\n        const classification = classifyFinancialEntry(row);\n        if (classification.type === 'receita_projeto') {\n          totals.obra += value;\n          addDetail('projetos', row, value, classification.label);\n        } else if (classification.type === 'receita_administrativa') {\n          totals.adm += value;\n          addDetail('projetos', row, value, classification.label);\n        } else if (classification.type === 'emprestimo') {\n          totals.emprestimos += value;\n          addDetail('capital', row, value, classification.label);\n        } else if (classification.type === 'aporte') {\n          totals.aportes += value;\n          addDetail('capital', row, value, classification.label);\n        } else {\n          totals.outras += value;\n          addDetail('outras', row, value, classification.label);\n        }\n      });\n    });`,
`    realizedFilteredData.forEach((item) => {\n      if (item.natureza !== 'Entrada') return;\n\n      const projectTotal = Number(item.valorReceitaProjetoTotal) || 0;\n      if (projectTotal) {\n        totals.obra += Number(item.valorDireto) || 0;\n        totals.adm += Number(item.valorAdministrativo) || 0;\n        const detailRow = {\n          ...item,\n          contaCodigo: '',\n          contaNome: item.projeto || 'Projeto nao identificado',\n          contaDescricao: item.projeto || 'Projeto nao identificado',\n        };\n        addDetail('projetos', detailRow, projectTotal, 'Receita do projeto');\n        return;\n      }\n\n      const classification = classifyFinancialEntry(item);\n      const value = Number(item.valor) || 0;\n      if (classification.type === 'emprestimo') {\n        totals.emprestimos += value;\n        addDetail('capital', item, value, classification.label);\n      } else if (classification.type === 'aporte') {\n        totals.aportes += value;\n        addDetail('capital', item, value, classification.label);\n      } else {\n        totals.outras += value;\n        addDetail('outras', item, value, classification.label);\n      }\n    });`,
'entryBreakdown'
);

replaceOnce(
`      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];\n      const projectRevenue = rows.reduce((sum, row) => {\n        const code = String(row.contaCodigo || '').replace(/\\D/g, '');\n        if (code !== '1010101' && code !== '1010107') return sum;\n        return sum + (Number(row.valor) || 0);\n      }, 0);`,
`      const projectRevenue = Number(item.valorReceitaProjetoTotal ?? item.valor) || 0;`,
'topProjetosEntradas'
);

replaceOnce(
`      receitaObra += Number(item.valorDireto) || 0;\n      receitaAdm += Number(item.valorAdministrativo) || 0;\n      receita += Number(item.valor) || 0;`,
`      receitaObra += Number(item.valorDireto) || 0;\n      receitaAdm += Number(item.valorAdministrativo) || 0;\n      receita += Number(item.valorReceitaProjetoTotal ?? item.valor) || 0;`,
'projectFinancialOverview total'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Visao financeira ajustada para rateio sistemico 80/20.');
