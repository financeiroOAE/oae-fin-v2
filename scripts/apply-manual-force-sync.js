const fs = require('fs');
const path = require('path');

const targets = [
  'src/app/page.js',
  'src/app/visao-financeira/page.js',
  'src/app/fluxo-caixa/page.js',
  'src/app/projetos/page.js',
  'src/app/dre/page.js',
];

for (const relativePath of targets) {
  const filePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) continue;

  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes("fetch('/api/sync'")) continue;

  src = src.replace(
    /const fetchDados = async \(\) => \{/g,
    'const fetchDados = async (force = false) => {'
  );

  src = src.replace(
    /fetch\('\/api\/sync', \{ method: 'GET' \}\)/g,
    "fetch(force ? '/api/sync?force=1' : '/api/sync', { method: 'GET', cache: 'no-store' })"
  );

  src = src.replace(
    /onClick=\{fetchDados\}/g,
    'onClick={() => fetchDados(true)}'
  );

  fs.writeFileSync(filePath, src);
  console.log(`Atualizado: ${relativePath}`);
}

console.log('Correção de sincronização manual aplicada.');
