const fs = require('fs');

function replaceOrFail(src, search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(search, replacement);
}

// Visao Financeira: rankings tambem devem respeitar a relacao oficial de projetos ativos.
{
  const file = 'src/app/visao-financeira/page.js';
  let src = fs.readFileSync(file, 'utf8');

  src = replaceOrFail(
    src,
`        const projectName = String(row.projeto || '').trim();
        const projectUpper = projectName.toUpperCase();
        if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
        map[projectName] = (map[projectName] || 0) + (Number(row.valor) || 0);`,
`        const projectName = String(row.projeto || '').trim();
        const projectUpper = projectName.toUpperCase();
        if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
        if (!activeProjectKeys.has(getProjectKey(projectName))) return;
        map[projectName] = (map[projectName] || 0) + (Number(row.valor) || 0);`,
    'ranking entradas ativos'
  );
  src = replaceOrFail(src, '  }, [filteredData]);\n\n  const topProjetosSaidas = useMemo(() => {', '  }, [filteredData, activeProjectKeys]);\n\n  const topProjetosSaidas = useMemo(() => {', 'deps ranking entradas');
  src = replaceOrFail(
    src,
`    filteredData.filter(i => i.natureza === 'Saída' && i.projeto).forEach(i => {
      map[i.projeto] = (map[i.projeto] || 0) + i.valor;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData]);`,
`    filteredData.filter(i => i.natureza === 'Saída' && i.projeto && activeProjectKeys.has(getProjectKey(i.projeto))).forEach(i => {
      map[i.projeto] = (map[i.projeto] || 0) + (Number(i.valor) || 0);
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filteredData, activeProjectKeys]);`,
    'ranking saidas ativos'
  );
  src = src.replace('Projeto / Centro de Custo', 'Projeto / Obra');
  fs.writeFileSync(file, src);
}

// Fluxo: valores do eixo anual tambem devem aparecer completos.
{
  const file = 'src/app/fluxo-caixa/page.js';
  let src = fs.readFileSync(file, 'utf8');
  src = replaceOrFail(
    src,
    '<YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `R$ ${(val / 1000)}k`} axisLine={false} tickLine={false} />',
    '<YAxis stroke="var(--text-secondary)" fontSize={10} width={110} tickFormatter={(val) => formatCurrency(val)} axisLine={false} tickLine={false} />',
    'eixo anual completo'
  );
  src = src.replace('Projeto / CC', 'Projeto / Obra');
  fs.writeFileSync(file, src);
}

console.log('Ajustes finais aplicados.');
