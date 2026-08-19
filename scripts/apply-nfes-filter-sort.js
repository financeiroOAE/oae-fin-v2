const fs = require('fs');
const p = 'src/app/fluxo-caixa/page.js';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
"  const totalFaturamentosNfes = faturamentosNfes.reduce((acc, row) => acc + row.valor, 0);",
`  const [filtroFaturamento, setFiltroFaturamento] = useState('MES_ATUAL');\n\n  const faturamentosNfesFiltrados = useMemo(() => {\n    const hoje = new Date();\n    const mesAtual = hoje.getMonth();\n    const anoAtual = hoje.getFullYear();\n\n    return faturamentosNfes\n      .filter((row) => {\n        if (filtroFaturamento === 'TODOS') return true;\n        if (!row.data) return false;\n        const [d, m, y] = String(row.data).split('/').map(Number);\n        if (!d || !m || !y) return false;\n        const vencimento = new Date(y, m - 1, d);\n        return vencimento.getMonth() === mesAtual && vencimento.getFullYear() === anoAtual;\n      })\n      .sort((a, b) => (a.dataTimestamp || 0) - (b.dataTimestamp || 0));\n  }, [faturamentosNfes, filtroFaturamento]);\n\n  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);`
);

s = s.replace(
`            <ChartHeader\n              title="Painel de Faturamento (NFES)"\n              infoTitle="Faturamento"\n              infoContent="Lista todas as receitas da CR_GERAL cujo documento inclui o termo 'NFES'."\n            />`,
`            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>\n              <ChartHeader\n                title="Painel de Faturamento (NFES)"\n                infoTitle="Faturamento"\n                infoContent="Lista receitas da CR_GERAL cujo documento inclui NFES, ordenadas por vencimento crescente. O filtro permite ver todos os documentos emitidos ou apenas os vencimentos do mês atual."\n              />\n              <select\n                value={filtroFaturamento}\n                onChange={(e) => setFiltroFaturamento(e.target.value)}\n                style={{ minWidth: '220px' }}\n                aria-label="Filtro do Painel de Faturamento"\n              >\n                <option value="MES_ATUAL">Vencimento no mês atual</option>\n                <option value="TODOS">Todos emitidos</option>\n              </select>\n            </div>`
);

s = s.replace(/faturamentosNfes\.length > 0 \? faturamentosNfes\.map\(/g, 'faturamentosNfesFiltrados.length > 0 ? faturamentosNfesFiltrados.map(');
s = s.replace(/faturamentosNfes\.length > 0 && \(/g, 'faturamentosNfesFiltrados.length > 0 && (');
s = s.replace('data={faturamentosNfes.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor }))}', 'data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor }))}');

fs.writeFileSync(p, s);
