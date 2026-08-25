const fs = require('fs');
const path = require('path');

function update(file, transform) {
  const full = path.join(process.cwd(), file);
  const src = fs.readFileSync(full, 'utf8');
  const next = transform(src);
  if (next === src) throw new Error(`Nenhuma alteração aplicada em ${file}`);
  fs.writeFileSync(full, next);
  console.log(`Atualizado: ${file}`);
}

function req(src, search, replacement, label) {
  const next = src.replace(search, replacement);
  if (next === src) throw new Error(`Trecho não encontrado: ${label}`);
  return next;
}

update('src/app/projetos/page.js', (input) => {
  let src = input;
  src = req(
    src,
    `  const topEntradasData = useMemo(() =>\n    [...filteredProjetos].filter(p => p.recebido > 0).sort((a, b) => b.recebido - a.recebido).slice(0, 5)\n      .map(p => ({ nome: p.nome, Valor: p.recebido })),\n    [filteredProjetos]);`,
    `  const topEntradasData = useMemo(() =>\n    [...filteredProjetos].filter(p => p.receitaDireta > 0).sort((a, b) => b.receitaDireta - a.receitaDireta).slice(0, 5)\n      .map(p => ({ nome: p.nome, Valor: p.receitaDireta })),\n    [filteredProjetos]);`,
    'fontes receita sem administracao'
  );
  return src;
});

update('src/app/visao-financeira/page.js', (input) => {
  let src = input;

  src = req(
    src,
    `  const topProjetosEntradas = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => {\n      const classification = classifyFinancialEntry(i);\n      return classification.type === 'receita_projeto' && i.projeto && !String(i.projeto).toUpperCase().includes('ADMINISTRA');\n    }).forEach(i => {\n      map[i.projeto] = (map[i.projeto] || 0) + i.valor;\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);\n  }, [filteredData]);`,
    `  const topProjetosEntradas = useMemo(() => {\n    const map = {};\n    filteredData.forEach(item => {\n      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];\n      rows.forEach(row => {\n        const classification = classifyFinancialEntry(row);\n        if (classification.type !== 'receita_projeto') return;\n        if (!row.projeto || String(row.projeto).toUpperCase().includes('ADMINISTRA')) return;\n        map[row.projeto] = (map[row.projeto] || 0) + (Number(row.valor) || 0);\n      });\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);\n  }, [filteredData]);`,
    'ranking projetos por linhas originais'
  );

  src = req(
    src,
    `  const entryCategoryData = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => i.natureza === 'Entrada').forEach(i => {\n      const classification = classifyFinancialEntry(i);\n      map[classification.label] = (map[classification.label] || 0) + (Number(i.valor) || 0);\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);\n  }, [filteredData]);`,
    `  const entryCategoryData = useMemo(() => {\n    const map = {};\n    filteredData.filter(i => i.natureza === 'Entrada').forEach(item => {\n      const rows = item.linhasOriginais?.length ? item.linhasOriginais : [item];\n      rows.forEach(row => {\n        const classification = classifyFinancialEntry(row);\n        map[classification.label] = (map[classification.label] || 0) + (Number(row.valor) || 0);\n      });\n    });\n    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);\n  }, [filteredData]);`,
    'categorias por linhas originais'
  );

  src = req(
    src,
    `    Natureza: item.natureza,\n    Valor: item.valor,`,
    `    Natureza: item.natureza,\n    "Classificação Financeira": item.natureza === 'Entrada' ? classifyFinancialEntry(item).label : 'Saída / Pagamento',\n    Valor: item.valor,`,
    'classificacao na tabela'
  );

  src = src.replaceAll('Recebido: entradasRealizadas', '"Entradas Realizadas": entradasRealizadas');
  src = src.replaceAll('Recebido: "currency"', '"Entradas Realizadas": "currency"');

  return src;
});

update('src/app/fluxo-caixa/page.js', (input) => {
  let src = input;
  src = req(
    src,
    `      </div>\n\n      {/* Linha Executiva Compacta de KPIs */}`,
    `      </div>\n\n      <div style={{ margin: '-0.5rem 0 1.25rem', padding: '0.75rem 0.9rem', borderLeft: '3px solid var(--primary)', background: 'var(--bg-elevated)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>\n        <strong style={{ color: 'var(--text-main)' }}>Como ler Entradas:</strong> este total representa dinheiro entrando no caixa e pode conter receita operacional, empréstimos/financiamentos, aportes e outras movimentações. Entrada de caixa não é automaticamente receita.\n      </div>\n\n      {/* Linha Executiva Compacta de KPIs */}`,
    'aviso classificacao fluxo'
  );

  src = src.replaceAll('>Entradas</p>', '>Entradas de Caixa</p>');
  src = src.replaceAll('Fluxo Anual Fixo (2026) independentemente dos filtros principais', 'Visão anual fixa de 2026; os filtros de conteúdo continuam válidos, mas o filtro de datas não limita este gráfico');
  return src;
});

console.log('Refinamentos financeiros aplicados.');
