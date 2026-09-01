const fs = require('fs');
const path = 'src/lib/businessRules.js';
let content = fs.readFileSync(path, 'utf8');

const oldComment = ` * Sempre que a identificação da obra for inequívoca, o nome exibido vem da relação oficial PROJETOS_2026.`;
const newComment = ` * O nome exibido prioriza o \"Nome centro de custo\" da movimentação.\n * A relação PROJETOS_2026 valida o código e fornece dados contratuais, mas não substitui um nome de centro de custo já informado.`;
if (!content.includes(oldComment)) throw new Error('Comentario alvo nao encontrado');
content = content.replace(oldComment, newComment);

const oldBlock = `      const canonicalSourceProject = resolveCanonicalSourceProject(projetoResolvido, rawCodigo, exactProjectNameIndex, projectIndex);\n      if (canonicalSourceProject) {\n        projetoResolvido = canonicalSourceProject.label;\n        projetoCodigoValidado = canonicalSourceProject.code || '';\n        projetoResolvidoPor = canonicalSourceProject.source;\n      }`;

const newBlock = `      const canonicalSourceProject = resolveCanonicalSourceProject(projetoResolvido, rawCodigo, exactProjectNameIndex, projectIndex);\n      if (canonicalSourceProject) {\n        projetoCodigoValidado = canonicalSourceProject.code || '';\n        projetoResolvidoPor = canonicalSourceProject.source;\n\n        const nomeCentroCustoAtual = normalizeText(projetoResolvido);\n        const nomeCentroCustoUtil = projetoResolvido\n          && nomeCentroCustoAtual !== 'SEM PROJETO'\n          && nomeCentroCustoAtual !== 'GRUPO OAE'\n          && nomeCentroCustoAtual !== 'PROJETOS'\n          && nomeCentroCustoAtual !== 'PROJETOS GERAL'\n          && nomeCentroCustoAtual !== 'PROJETOS GERAIS';\n\n        // Fonte de verdade visual: Nome centro de custo.\n        // So usamos o rotulo do catalogo quando o lancamento nao possui nome util.\n        if (!nomeCentroCustoUtil) {\n          projetoResolvido = canonicalSourceProject.label;\n        }\n      }`;

if (!content.includes(oldBlock)) throw new Error('Bloco de canonicalizacao alvo nao encontrado');
content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content, 'utf8');
console.log('Regra de nome dos projetos corrigida para priorizar Nome centro de custo.');
