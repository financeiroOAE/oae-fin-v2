const fs = require('fs');

function replaceOnce(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  return text.replace(before, after);
}

const drePath = 'src/app/dre/page.js';
let dre = fs.readFileSync(drePath, 'utf8');

const oldAccountCell = `      <td style={{
        padding: \`0.625rem 1rem 0.625rem \${paddingLeft}\`, fontSize: "12px",
        color: "var(--text-secondary)", position: "sticky", left: 0, zIndex: 1,
        background: "rgba(6,24,48,0.98)", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>→</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "280px" }} title={account.label}>
          {account.label}
        </span>
        <FileText size={10} color="rgba(168,181,198,0.4)" style={{ flexShrink: 0 }} />
      </td>`;

const newAccountCell = `      <td className="dre-description-cell" style={{
        padding: \`0.625rem 1rem 0.625rem \${paddingLeft}\`, fontSize: "12px",
        color: "var(--text-secondary)", position: "sticky", left: 0, zIndex: 1,
        background: "rgba(6,24,48,0.98)", whiteSpace: "normal",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>→</span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "normal", overflowWrap: "normal", wordBreak: "normal", lineHeight: 1.25 }} title={account.label}>
            {account.label}
          </span>
          <FileText size={10} color="rgba(168,181,198,0.4)" style={{ flexShrink: 0 }} />
        </div>
      </td>`;

dre = replaceOnce(dre, oldAccountCell, newAccountCell, 'celula de descricao das contas DRE');
fs.writeFileSync(drePath, dre, 'utf8');

const cssPath = 'src/app/globals.css';
let css = fs.readFileSync(cssPath, 'utf8');

const oldDescriptionCss = `.dre-responsive-table th:first-child,
.dre-responsive-table td:first-child {
  width: 22%;
  position: static !important;
  overflow-wrap: anywhere;
  padding-left: 0.55rem !important;
  padding-right: 0.35rem !important;
}`;

const newDescriptionCss = `.dre-responsive-table th:first-child,
.dre-responsive-table td:first-child {
  width: 22%;
  position: static !important;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
  padding-left: 0.55rem !important;
  padding-right: 0.35rem !important;
}
.dre-responsive-table .dre-description-cell {
  display: table-cell !important;
}
.dre-responsive-table .dre-description-cell > div,
.dre-responsive-table .dre-description-cell span {
  word-break: normal !important;
  overflow-wrap: normal !important;
  hyphens: none !important;
}`;

css = replaceOnce(css, oldDescriptionCss, newDescriptionCss, 'CSS da coluna descricao DRE');
fs.writeFileSync(cssPath, css, 'utf8');

console.log('Nomes/classificacoes da DRE corrigidos sem alterar as colunas financeiras.');
