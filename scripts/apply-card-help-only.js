const fs = require('fs');
const path = require('path');

const uiPath = path.join(process.cwd(), 'src/components/UiEnhancements.jsx');
const cssPath = path.join(process.cwd(), 'src/app/ui-fixes.css');

let ui = fs.readFileSync(uiPath, 'utf8');

const start = ui.indexOf('const chartTitlePattern =');
const end = ui.indexOf('export default function UiEnhancements()');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Bloco de ferramentas dos gráficos não encontrado.');
}

const replacement = `const demonstrativeCardPattern = /(saldo|contrat|fatur|receb|entrada|receita|pagamento|pago|pagar|resultado|margem|curva|progresso|imposto|custo|despesa|status|ranking|top\\s|evolução|evolucao|composição|composicao|distribuição|distribuicao|financeiro)/i;

function cardExplanation(title) {
  const text = cleanText(title).toLowerCase();

  if (text.includes('saldo banc')) return {
    what: 'Soma dos saldos das contas bancárias cadastradas.',
    read: 'Valor positivo é disponibilidade em conta. Valor negativo indica saldo bancário devedor.'
  };
  if (text.includes('saldo contrat')) return {
    what: 'Valor do contrato que ainda não foi faturado.',
    read: 'Quanto maior o saldo, maior o valor que ainda resta faturar no contrato.'
  };
  if (text.includes('valor contratado') || text === 'contratado') return {
    what: 'Valor total dos contratos dos projetos exibidos.',
    read: 'É a base contratual da carteira, antes de comparar quanto já foi faturado.'
  };
  if (text.includes('% fatur') || text.includes('percentual fatur')) return {
    what: 'Percentual do contrato que já foi faturado.',
    read: '100% significa que todo o valor contratado já foi faturado.'
  };
  if (text.includes('faturado') && !text.includes('imposto')) return {
    what: 'Valor já faturado dos contratos.',
    read: 'Compare com o valor contratado para entender quanto do contrato já avançou.'
  };
  if (text.includes('a receber')) return {
    what: 'Valores registrados que ainda devem entrar no caixa.',
    read: 'É compromisso de entrada futura registrado no sistema; não significa que o dinheiro já entrou.'
  };
  if (text.includes('recebido') || text.includes('entradas realizadas')) return {
    what: 'Valores que já entraram no caixa no período considerado.',
    read: 'Entrada de caixa não é sempre receita: empréstimos e aportes devem ser lidos separadamente quando aparecerem na composição.'
  };
  if (text.includes('a pagar')) return {
    what: 'Valores registrados que ainda precisam ser pagos.',
    read: 'Mostra compromissos futuros de saída do caixa no período considerado.'
  };
  if (text === 'pago' || text.includes('pagamentos realizados')) return {
    what: 'Valores que já saíram do caixa no período considerado.',
    read: 'Quanto maior o valor, maior foi o desembolso realizado.'
  };
  if (text.includes('curva abc')) return {
    what: 'Agrupa os projetos pelo valor total de seus contratos.',
    read: 'A: acima de R$ 500 mil. B: de R$ 100 mil a R$ 500 mil. C: abaixo de R$ 100 mil.'
  };
  if (text.includes('progresso') && text.includes('contrat')) return {
    what: 'Compara o valor contratado, o faturado e o saldo a faturar de cada projeto.',
    read: 'Quanto maior o percentual faturado, mais avançado está o contrato.'
  };
  if (text.includes('imposto')) return {
    what: 'Mostra os impostos ligados ao faturamento dos projetos.',
    read: 'Retenções de fornecedores não entram aqui. Valores maiores indicam maior peso dos impostos sobre o faturamento.'
  };
  if (text.includes('composição') || text.includes('composicao')) return {
    what: 'Separa as entradas conforme sua origem financeira.',
    read: 'Receitas, empréstimos, financiamentos e aportes aparecem separados para não tratar toda entrada de caixa como receita.'
  };
  if (text.includes('receita') || text.includes('fonte')) return {
    what: 'Mostra de onde vêm as receitas exibidas no período.',
    read: 'Quanto maior a barra ou participação, maior a contribuição daquela fonte ou projeto.'
  };
  if (text.includes('despesa') || text.includes('custo') || text.includes('saída') || text.includes('saida')) return {
    what: 'Mostra onde os gastos estão concentrados.',
    read: 'Quanto maior a barra ou valor, maior o gasto daquele projeto, conta ou grupo.'
  };
  if (text.includes('anual')) return {
    what: 'Mostra as movimentações financeiras mês a mês no ano.',
    read: 'Entradas programadas são títulos registrados a receber. Não são meta, orçamento ou faturamento esperado.'
  };
  if (text.includes('resultado')) return {
    what: 'Mostra a diferença entre entradas e saídas consideradas no cálculo.',
    read: 'Positivo significa mais entradas que saídas; negativo significa mais saídas que entradas.'
  };
  if (text.includes('margem')) return {
    what: 'Mostra quanto do resultado representa em relação à receita.',
    read: 'Percentuais maiores indicam maior resultado proporcional sobre a receita considerada.'
  };
  if (text.includes('status')) return {
    what: 'Divide os valores conforme a situação financeira atual.',
    read: 'Compare realizado e pendente para entender o que já aconteceu e o que ainda está em aberto.'
  };
  if (text.includes('evolução') || text.includes('evolucao') || text.includes('financeiro')) return {
    what: 'Resume visualmente a movimentação financeira apresentada neste card.',
    read: 'Compare os períodos e valores. Elementos maiores representam maior participação ou volume.'
  };

  return {
    what: 'Resume este indicador de forma visual.',
    read: 'Use o valor principal e sua comparação com os demais indicadores para entender a posição apresentada.'
  };
}

function getDemonstrativeCardTitleNode(card) {
  const heading = card.querySelector('h2, h3');
  if (heading) return heading;

  const labels = Array.from(card.querySelectorAll(':scope > p, :scope > div > p'));
  return labels.find((node) => {
    const text = cleanText(node.textContent);
    return text && /[A-Za-zÀ-ÿ]/.test(text) && !/^R\\$/.test(text) && text.length <= 90;
  }) || null;
}

function isDemonstrativeCard(card) {
  if (!card || card.querySelector('[data-card-help]')) return false;
  if (card.querySelector('input, select, textarea, table')) return false;
  if (card.querySelector(':scope .card')) return false;

  const titleNode = getDemonstrativeCardTitleNode(card);
  if (!titleNode) return false;

  const title = cleanText(titleNode.textContent);
  const fullText = cleanText(card.textContent);
  const hasVisual = Boolean(card.querySelector('.recharts-wrapper, canvas'));
  const hasMetric = /R\\$|%/.test(fullText);
  const isKnownCard = demonstrativeCardPattern.test(title);

  return hasVisual || (hasMetric && isKnownCard);
}

function closeOtherCardPopovers(current) {
  document.querySelectorAll('[data-card-popover]').forEach((popover) => {
    if (popover !== current) popover.hidden = true;
  });
}

function removeDemonstrativeCardHelp() {
  document.querySelectorAll('[data-chart-tools], [data-card-help]').forEach((node) => node.remove());
  document.querySelectorAll('.has-demonstrative-help').forEach((card) => card.classList.remove('has-demonstrative-help'));
}

function installDemonstrativeCardHelp() {
  // Remove qualquer controle antigo de gráfico, inclusive download/menus.
  document.querySelectorAll('[data-chart-tools]').forEach((node) => node.remove());

  document.querySelectorAll('.card').forEach((card) => {
    if (!isDemonstrativeCard(card)) return;

    const titleNode = getDemonstrativeCardTitleNode(card);
    if (!titleNode) return;
    const title = cleanText(titleNode.textContent) || 'Indicador';
    const explanation = cardExplanation(title);

    card.classList.add('has-demonstrative-help');

    const wrap = document.createElement('span');
    wrap.setAttribute('data-card-help', 'true');
    wrap.className = 'card-help-wrap';

    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'card-help-icon';
    help.setAttribute('aria-label', \`Entenda o card \${title}\`);
    help.setAttribute('title', 'Entenda este card');
    help.textContent = '?';

    const popover = document.createElement('div');
    popover.setAttribute('data-card-popover', 'true');
    popover.className = 'card-help-popover';
    popover.hidden = true;
    popover.innerHTML = \`
      <strong>O que é</strong>
      <p>\${explanation.what}</p>
      <strong>Leitura</strong>
      <p>\${explanation.read}</p>
    \`;

    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherCardPopovers(popover);
      popover.hidden = !willOpen;
    };

    wrap.appendChild(help);
    wrap.appendChild(popover);
    titleNode.appendChild(wrap);
  });
}

`;

ui = ui.slice(0, start) + replacement + ui.slice(end);

ui = ui.replace(
  /\s*installChartTools\(\);/g,
  `\n        if (pathname.startsWith('/fluxo-caixa')) {\n          removeDemonstrativeCardHelp();\n        } else {\n          installDemonstrativeCardHelp();\n        }`
);
ui = ui.replace(/closeOtherChartPopovers\(null\)/g, 'closeOtherCardPopovers(null)');

fs.writeFileSync(uiPath, ui);

let css = fs.readFileSync(cssPath, 'utf8');
const cssStart = css.indexOf('.chart-utility-tools');
const cssEnd = css.indexOf('.account-group-separator td');
if (cssStart < 0 || cssEnd < 0 || cssEnd <= cssStart) {
  throw new Error('Bloco CSS antigo dos gráficos não encontrado.');
}

const helpCss = `.card-help-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  vertical-align: middle;
}

.card-help-icon {
  width: 20px;
  height: 20px;
  min-width: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.62;
  transition: all 0.16s ease;
}

.card-help-icon:hover,
.card-help-icon:focus-visible {
  opacity: 1;
  color: var(--text-main);
  border-color: var(--border-color);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  outline: none;
}

.card-help-popover {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 80;
  width: min(300px, calc(100vw - 40px));
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: color-mix(in srgb, var(--bg-card) 97%, transparent);
  box-shadow: 0 12px 28px rgba(0,0,0,0.28);
  backdrop-filter: blur(12px);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
}

.card-help-popover[hidden] {
  display: none !important;
}

.card-help-popover strong {
  display: block;
  color: var(--text-main);
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 0.18rem;
}

.card-help-popover p {
  margin: 0 0 0.65rem;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
  text-transform: none;
}

.card-help-popover p:last-child {
  margin-bottom: 0;
}

/* Nos cards demonstrativos, usamos somente o ? de leitura para não duplicar ajuda. */
.has-demonstrative-help > .info-tooltip-container,
.has-demonstrative-help h2 > .info-tooltip-container,
.has-demonstrative-help h3 > .info-tooltip-container {
  display: none !important;
}

`;

css = css.slice(0, cssStart) + helpCss + css.slice(cssEnd);
css = css.replace(/\n\s*\.chart-utility-tools \{[\s\S]*?\n\s*\}/g, '');
css = css.replace(/\n\s*\.chart-popover \{[\s\S]*?\n\s*\}/g, '');

const mobileMarker = '@media (max-width: 900px) {';
const mobileIndex = css.indexOf(mobileMarker);
if (mobileIndex >= 0 && !css.includes('.card-help-popover {\n    position: fixed;')) {
  const insertAt = css.indexOf('\n}', mobileIndex);
  if (insertAt >= 0) {
    const mobileHelp = `\n\n  .card-help-popover {\n    position: fixed;\n    top: auto;\n    right: 16px;\n    left: 16px;\n    bottom: 16px;\n    width: auto;\n  }`;
    css = css.slice(0, insertAt) + mobileHelp + css.slice(insertAt);
  }
}

fs.writeFileSync(cssPath, css);
console.log('Ajuda discreta aplicada somente aos cards demonstrativos; Fluxo de Caixa sem controles e download removido.');
