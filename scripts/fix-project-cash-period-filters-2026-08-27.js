const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return content.replace(before, after);
}

let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOnce(
  page,
  `      // Realizados seguem o período; títulos em aberto são posição atual e não\n      // desaparecem só porque vencem depois da Data Final.\n      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;`,
  `      // Todos os valores do Consolidado de Caixa obedecem ao período selecionado.\n      // Isso vale tanto para realizados quanto para A Receber / A Pagar.\n      if (ts < realizadoIni || ts > realizadoFim) return;`,
  'periodo em projetosCruzados'
);

page = replaceOnce(
  page,
  `  const previsaoProjetosGeral = useMemo(() => data\n    .filter((item) => {\n      const status = String(item.status || '').toUpperCase();\n      return item.natureza === 'Saída'\n        && (status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'))\n        && isGeneralProjectsBucket(item.projeto);\n    })\n    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [data]);`,
  `  const previsaoProjetosGeral = useMemo(() => data\n    .filter((item) => {\n      const status = String(item.status || '').toUpperCase();\n      if (item.natureza !== 'Saída'\n        || !(status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO'))\n        || !isGeneralProjectsBucket(item.projeto)) return false;\n\n      let ts = 0;\n      if (item.data) {\n        const parts = String(item.data).split('/');\n        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();\n      }\n      return ts >= realizadoIni && ts <= realizadoFim;\n    })\n    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0), [data, realizadoIni, realizadoFim]);`,
  'previsao geral respeitando periodo'
);

page = replaceOnce(
  page,
  `      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) recReceita += Number(item.valor) || 0;\n      if (isPrevisto) recAReceber += Number(item.valor) || 0;`,
  `      if (isRealizado && ts >= realizadoIni && ts <= realizadoFim) recReceita += Number(item.valor) || 0;\n      if (isPrevisto && ts >= realizadoIni && ts <= realizadoFim) recAReceber += Number(item.valor) || 0;`,
  'DRE a receber respeitando periodo'
);

page = replaceOnce(
  page,
  `      if (!isRealizado && !isPrevisto) return;\n      if (isRealizado && (ts < realizadoIni || ts > realizadoFim)) return;`,
  `      if (!isRealizado && !isPrevisto) return;\n      if (ts < realizadoIni || ts > realizadoFim) return;`,
  'DRE saidas previstas respeitando periodo'
);

page = replaceOnce(
  page,
  `    selectedProjectMoves.forEach(item => {`,
  `    selectedProjectReportMoves.forEach(item => {`,
  'custos de equipe usam movimentos filtrados'
);

page = replaceOnce(
  page,
  `  }, [selectedProject, selectedProjectMoves]);`,
  `  }, [selectedProject, selectedProjectReportMoves]);`,
  'dependencia custos equipe filtrados'
);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Filtros de periodo aplicados a realizados e previstos no Consolidado de Caixa.');
