const fs = require('fs');

const file = 'src/app/visao-financeira/page.js';
let src = fs.readFileSync(file, 'utf8');

const beforeTributos = `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span><strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong></div>`;
const afterTributos = `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Tributos</span><strong style={{display:'block',fontSize:'14px',color:'var(--warning)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.tributos)}</strong></div>`;

const beforeResultado = `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:projectFinancialOverview.resultado >= 0 ? 'var(--success)' : 'var(--danger)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>`;
const afterResultado = `<div><span style={{fontSize:'10px',color:'var(--text-secondary)',textTransform:'uppercase'}}>Resultado</span><strong style={{display:'block',fontSize:'14px',color:'var(--primary)',overflowWrap:'anywhere'}}>{formatCurrency(projectFinancialOverview.resultado)}</strong></div>`;

if (!src.includes(beforeTributos)) throw new Error('Trecho de Tributos nao encontrado');
if (!src.includes(beforeResultado)) throw new Error('Trecho de Resultado nao encontrado');

src = src.replace(beforeTributos, afterTributos);
src = src.replace(beforeResultado, afterResultado);

fs.writeFileSync(file, src, 'utf8');
console.log('Cores alinhadas: Recebido=success, Custos=danger, Tributos=warning, Resultado=primary.');
