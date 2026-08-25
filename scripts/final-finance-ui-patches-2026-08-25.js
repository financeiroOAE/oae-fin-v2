const fs = require('fs');

function replaceOrFail(src, search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(search, replacement);
}

// Visao Financeira: rankings tambem devem respeitar a relacao oficial de projetos ativos.
{
  const file = 'src/app/visao-financeira/page.js';
  let src = fs.readFileSync(file, 'utf8');

  if (!src.includes('activeProjectKeys.has(getProjectKey(projectName))')) {
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
  }

  if (!src.includes("activeProjectKeys.has(getProjectKey(i.projeto))")) {
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
  }

  src = src.replace('Projeto / Centro de Custo', 'Projeto / Obra');
  fs.writeFileSync(file, src);
}

// Fluxo: remover todas as abreviacoes monetarias em milhares do eixo.
{
  const file = 'src/app/fluxo-caixa/page.js';
  let src = fs.readFileSync(file, 'utf8');
  const shortFormatter = 'tickFormatter={(val) => `R$ ${(val / 1000)}k`}';
  src = src.split(shortFormatter).join('tickFormatter={(val) => formatCurrency(val)}');
  src = src.replace('Projeto / CC', 'Projeto / Obra');
  if (src.includes(shortFormatter)) throw new Error('Ainda existe valor abreviado no Fluxo.');
  fs.writeFileSync(file, src);
}

console.log('Ajustes finais validados.');
