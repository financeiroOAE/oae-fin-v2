const fs = require('fs');

const cssPath = 'src/app/globals.css';
const exportPath = 'src/lib/reportExport.js';

let css = fs.readFileSync(cssPath, 'utf8');
let reportExport = fs.readFileSync(exportPath, 'utf8');

const cssBefore = '.report-preview-sections { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem; }';
const cssAfter = '.report-preview-sections { display: flex; flex-direction: column; gap: 2.25rem; margin-top: 1.5rem; }';

if (!css.includes(cssBefore)) {
  throw new Error('Regra de espacamento da previa do relatorio nao encontrada.');
}
css = css.replace(cssBefore, cssAfter);

const exportBefore = `    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {\n      drawTable({ ...item, columns: undefined }, item.pendingData, "Pendências incluídas");\n    }\n  }`;

const exportAfter = `    if (item.includePending && Array.isArray(item.pendingData) && item.pendingData.length > 0) {\n      drawTable({ ...item, columns: undefined }, item.pendingData, "Pendências incluídas");\n    }\n\n    // Respiro visual entre um topico e o seguinte no PDF.\n    if (y < maxY) y += 8;\n  }`;

if (!reportExport.includes(exportBefore)) {
  throw new Error('Loop de secoes do PDF nao encontrado.');
}
reportExport = reportExport.replace(exportBefore, exportAfter);

fs.writeFileSync(cssPath, css, 'utf8');
fs.writeFileSync(exportPath, reportExport, 'utf8');
console.log('Espacamento entre topicos dos relatorios aumentado na previa e no PDF.');
