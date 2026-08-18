const fs = require('fs');

const applyToPage = (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');

  if (!content.includes('import { useReport }')) {
    content = content.replace(/(import .*;\n)+/m, match => match + 'import { useReport } from "@/contexts/ReportContext";\nimport ReportAdder from "@/components/report/ReportAdder";\nimport { FileText } from "lucide-react";\n');
  }

  if (!content.includes('const { isReportMode, toggleReportMode } = useReport();')) {
    content = content.replace(/export default function \w+\(.*\) {/, match => match + '\n  const { isReportMode, toggleReportMode } = useReport();');
  }

  const btnFind = '{lastSync && <span style={{ fontSize: \'12px\', color: \'var(--text-secondary)\' }}><Database size={12} style={{';
  const btnAdder = `<button onClick={toggleReportMode} className={\`btn \${isReportMode ? 'btn-primary' : ''}\`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', background: isReportMode ? 'var(--primary)' : 'var(--bg-elevated)', color: isReportMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            <FileText size={14} /> {isReportMode ? 'Sair do Modo Relatório' : 'Gerar Relatório'}
          </button>
          `;

  if (content.includes(btnFind) && !content.includes('Gerar Relatório')) {
    content = content.replace(btnFind, btnAdder + btnFind);
  }

  fs.writeFileSync(filepath, content);
};

applyToPage('src/app/visao-financeira/page.js');
applyToPage('src/app/dre/page.js');
applyToPage('src/app/fluxo-caixa/page.js');
