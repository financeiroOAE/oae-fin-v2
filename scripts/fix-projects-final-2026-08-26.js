const fs = require('fs');

const path = 'src/app/projetos/page.js';
let content = fs.readFileSync(path, 'utf8');

const anchor = `  const previsaoProjetosGeral = useMemo(() => data\n`;
if (!content.includes(anchor)) throw new Error('Ancora de previsao nao encontrada');
if (!content.includes('const usarCarteiraCompleta =')) {
  content = content.replace(
    anchor,
    `  const usarCarteiraCompleta = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;\n\n${anchor}`
  );
}

fs.writeFileSync(path, content);
console.log('Regra final de Projetos aplicada.');
