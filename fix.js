const fs = require('fs');

let visao = fs.readFileSync('src/app/visao-financeira/page.js', 'utf8');
visao = visao.replace('import { FileText } from "lucide-react";\n', '');
fs.writeFileSync('src/app/visao-financeira/page.js', visao);

let dre = fs.readFileSync('src/app/dre/page.js', 'utf8');
dre = dre.replace('import { FileText } from "lucide-react";\n', '');
fs.writeFileSync('src/app/dre/page.js', dre);

let fluxo = fs.readFileSync('src/app/fluxo-caixa/page.js', 'utf8');
fluxo = fluxo.replace('import { FileText } from "lucide-react";\n', '');
fs.writeFileSync('src/app/fluxo-caixa/page.js', fluxo);

let proj = fs.readFileSync('src/app/projetos/page.js', 'utf8');
proj = proj.replace('</div> realizadas no período', ' realizadas no período');
proj = proj.replace('</div> não inclui previsões a pagar', ' não inclui previsões a pagar');

fs.writeFileSync('src/app/projetos/page.js', proj);
