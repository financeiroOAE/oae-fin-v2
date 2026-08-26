const fs = require('fs');

const path = 'src/app/projetos/page.js';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = `    if (usarCarteiraCompleta) {
      recReceita = rawProjectRevenueStats.recebido;
      recAReceber = rawProjectRevenueStats.aReceber;
    }`;
const newBlock = `    if (usarCarteiraCompleta) {
      recReceita = receitaLiquidaProjetos;
      recAReceber = totalAReceber;
    }`;

if (!content.includes(oldBlock)) throw new Error('Bloco residual rawProjectRevenueStats nao encontrado');
content = content.replace(oldBlock, newBlock);

const oldDeps = `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, rawProjectRevenueStats]);`;
const newDeps = `  }, [data, filteredProjetos, realizadoIni, realizadoFim, incluirRateioAdm, usarCarteiraCompleta, receitaLiquidaProjetos, totalAReceber]);`;

if (!content.includes(oldDeps)) throw new Error('Dependencia residual rawProjectRevenueStats nao encontrada');
content = content.replace(oldDeps, newDeps);

if (content.includes('rawProjectRevenueStats')) throw new Error('Ainda existe referencia a rawProjectRevenueStats');

fs.writeFileSync(path, content);
console.log('Referencia residual removida e Projetos mantido na regra consolidada.');
