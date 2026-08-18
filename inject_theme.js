const fs = require('fs');
let layout = fs.readFileSync('src/app/layout.js', 'utf8');
if (!layout.includes('ThemeProvider')) {
  layout = layout.replace('import { ReportProvider } from "@/contexts/ReportContext";', 'import { ReportProvider } from "@/contexts/ReportContext";\nimport { ThemeProvider } from "@/contexts/ThemeContext";');
  layout = layout.replace('<ReportProvider>', '<ThemeProvider>\n        <ReportProvider>');
  layout = layout.replace('</ReportProvider>', '</ReportProvider>\n        </ThemeProvider>');
}
fs.writeFileSync('src/app/layout.js', layout);
