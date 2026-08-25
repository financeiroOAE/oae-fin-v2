const fs = require('fs');

function replaceOrFail(src, search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(search, replacement);
}

// 1) Icone i no canto superior direito, com hover
const uiFile = 'src/components/UiEnhancements.jsx';
let ui = fs.readFileSync(uiFile, 'utf8');

ui = replaceOrFail(
  ui,
  "    help.textContent = '?';",
  "    help.textContent = 'i';",
  'icone de ajuda'
);

ui = replaceOrFail(
  ui,
`    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherCardPopovers(popover);
      popover.hidden = !willOpen;
    };

    wrap.appendChild(help);
    wrap.appendChild(popover);
    titleNode.appendChild(wrap);`,
`    const openHelp = () => {
      closeOtherCardPopovers(popover);
      popover.hidden = false;
    };
    const closeHelp = () => {
      popover.hidden = true;
    };

    wrap.addEventListener('mouseenter', openHelp);
    wrap.addEventListener('mouseleave', closeHelp);
    help.onfocus = openHelp;
    help.onblur = closeHelp;
    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherCardPopovers(popover);
      popover.hidden = !willOpen;
    };

    wrap.appendChild(help);
    wrap.appendChild(popover);
    card.appendChild(wrap);`,
  'interacao hover e posicao do card'
);

ui = replaceOrFail(
  ui,
`  if (text.includes('anual')) return {
    what: 'Mostra as movimentações financeiras mês a mês no ano.',
    read: 'Entradas programadas são títulos registrados a receber. Não são meta, orçamento ou faturamento esperado.'
  };`,
`  if (text.includes('anual')) return {
    what: 'Mostra, mês a mês, o que entrou, o que ainda está programado para entrar e o que saiu do caixa em 2026.',
    read: 'Entradas realizadas já aconteceram. Entradas programadas são títulos registrados a receber — não são meta, orçamento nem faturamento esperado. Saídas são os pagamentos do período.'
  };`,
  'explicacao anual'
);

fs.writeFileSync(uiFile, ui);

// 2) Posicao do icone e popover
const cssFile = 'src/app/ui-fixes.css';
let css = fs.readFileSync(cssFile, 'utf8');

css = replaceOrFail(
  css,
`.card-help-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  vertical-align: middle;
}`,
`.has-demonstrative-help {
  position: relative;
}

.card-help-wrap {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 70;
  display: inline-flex;
  align-items: center;
}`,
  'posicao do info no card'
);

css = replaceOrFail(
  css,
`.card-help-popover {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;`,
`.card-help-popover {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  left: auto;`,
  'posicao do popover'
);

css = css.replace('/* Nos cards demonstrativos, usamos somente o ? de leitura para não duplicar ajuda. */', '/* Nos cards demonstrativos, usamos somente o i de informação para não duplicar ajuda. */');
fs.writeFileSync(cssFile, css);

// 3) Visao financeira: retirar descricao solta do anual e manter apenas no i
const visaoFile = 'src/app/visao-financeira/page.js';
let visao = fs.readFileSync(visaoFile, 'utf8');

visao = replaceOrFail(
  visao,
`            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Movimentações Financeiras Anuais — 2026</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Entradas realizadas, títulos programados a receber e saídas. Entradas programadas não são meta nem orçamento. Visão anual independente do filtro de datas.</p>`,
`            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-main)' }}>Movimentações Financeiras Anuais — 2026</h2>`,
  'descricao anual visivel'
);

visao = replaceOrFail(
  visao,
`        if (classification.type !== 'receita_projeto') return;
        if (!row.projeto || String(row.projeto).toUpperCase().includes('ADMINISTRA')) return;
        map[row.projeto] = (map[row.projeto] || 0) + (Number(row.valor) || 0);`,
`        if (classification.type !== 'receita_projeto') return;
        const projectName = String(row.projeto || '').trim();
        const projectUpper = projectName.toUpperCase();
        if (!projectName || projectUpper.includes('ADMINISTRA') || projectUpper === 'GRUPO OAE' || projectUpper === 'SEM PROJETO') return;
        map[projectName] = (map[projectName] || 0) + (Number(row.valor) || 0);`,
  'filtro de projeto generico no ranking'
);

fs.writeFileSync(visaoFile, visao);
console.log('Icone i/hover, card anual e filtro de ranking aplicados.');
