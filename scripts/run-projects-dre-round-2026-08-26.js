const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'apply-projects-dre-round-2026-08-26.js');
const tempPath = path.join(__dirname, '.apply-projects-dre-round-2026-08-26.fixed.js');
let source = fs.readFileSync(sourcePath, 'utf8');

const broken = '${300 + meses.length * 130}px';
const fixed = '${300 + meses.length * 130}px'.replace('${', '\\${');

if (!source.includes(broken)) {
  throw new Error('Interpolacao esperada da tabela DRE nao encontrada no aplicador.');
}

source = source.replace(broken, fixed);
fs.writeFileSync(tempPath, source, 'utf8');

try {
  require(tempPath);
} finally {
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
}
