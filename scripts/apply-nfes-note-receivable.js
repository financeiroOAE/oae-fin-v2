const fs = require('fs');

const file = 'src/app/fluxo-caixa/page.js';
let src = fs.readFileSync(file, 'utf8');

function replaceOrFail(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  src = src.replace(search, replacement);
}

replaceOrFail(
`  // Novos blocos analíticos (Dia e Faturamento)\n  const faturamentosNfes = useMemo(() => {\n    const rawList = baseData.filter(item =>\n      item.natureza === 'Entrada' &&\n      item.statusExibicao === 'A receber' &&\n      item.documento &&\n      item.documento.toUpperCase().includes('NFES')\n    );\n\n    // Agregação por Título / Documento (consolida a divisão ADM/Operacional)\n    const map = {};\n    rawList.forEach(item => {\n      const key = item.documento || item.nome || item.lancamento;\n      if (!map[key]) {\n        map[key] = { ...item };\n      } else {\n        map[key].valor += item.valor;\n        // Se a nova linha tem um projeto válido não-adm, sobrescrevemos o projeto adm\n        const isCurrentAdm = map[key].projeto && map[key].projeto.toUpperCase().includes('ADMINISTRA');\n        const isNewAdm = item.projeto && item.projeto.toUpperCase().includes('ADMINISTRA');\n\n        if (isCurrentAdm && !isNewAdm && item.projeto) {\n          map[key].projeto = item.projeto;\n        }\n      }\n    });\n    return Object.values(map).sort((a, b) => b.dataTimestamp - a.dataTimestamp);\n  }, [baseData]);`,
`  // Novos blocos analíticos (Dia e Faturamento)\n  const faturamentosNfes = useMemo(() => {\n    const rawList = baseData.filter(item =>\n      item.natureza === 'Entrada' &&\n      item.statusExibicao === 'A receber' &&\n      item.documento &&\n      item.documento.toUpperCase().includes('NFES')\n    );\n\n    // Uma NFES pode aparecer dividida em linhas operacionais/administrativas.\n    // Valor da Nota vem de \"Valor total título\" e nunca deve ser somado entre\n    // essas divisões. Valor a Receber é a soma real da coluna Valor.\n    const map = {};\n    rawList.forEach(item => {\n      const key = `${item.lancamento || 'SEM-LANCAMENTO'}|${item.documento || item.nome || 'SEM-DOCUMENTO'}`;\n      const valoresNota = [\n        Number(item.valorTotalTitulo) || 0,\n        ...(Array.isArray(item.linhasOriginais)\n          ? item.linhasOriginais.map(linha => Number(linha.valorTotalTitulo) || 0)\n          : [])\n      ].filter(valor => valor > 0);\n      const valorNota = valoresNota.length ? Math.max(...valoresNota) : 0;\n      const valorAReceber = Number(item.valor) || 0;\n\n      if (!map[key]) {\n        map[key] = {\n          ...item,\n          valorNota,\n          valorAReceber,\n        };\n      } else {\n        map[key].valorAReceber += valorAReceber;\n        map[key].valorNota = Math.max(map[key].valorNota || 0, valorNota);\n\n        // Se a nova linha tem um projeto válido não-adm, sobrescrevemos o projeto adm.\n        const isCurrentAdm = map[key].projeto && map[key].projeto.toUpperCase().includes('ADMINISTRA');\n        const isNewAdm = item.projeto && item.projeto.toUpperCase().includes('ADMINISTRA');\n        if (isCurrentAdm && !isNewAdm && item.projeto) {\n          map[key].projeto = item.projeto;\n        }\n      }\n    });\n    return Object.values(map).sort((a, b) => b.dataTimestamp - a.dataTimestamp);\n  }, [baseData]);`
, 'agregacao NFES');

replaceOrFail(
`  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);`,
`  const totalValorNotasNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorNota) || 0), 0);\n  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorAReceber) || 0), 0);`,
'Totais NFES');

replaceOrFail(
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />`,
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Vencimento: row.data, "Valor da Nota": row.valorNota, "Valor a Receber": row.valorAReceber }))} filters={{ Tipo: "NFES", Situação: "A receber", Visão: filtroFaturamento === 'TODOS' ? 'Todos emitidos' : 'Vencimento no mês atual' }} style={{ float: 'right' }} />`,
'ReportAdder NFES');

replaceOrFail(
`                infoContent="Lista receitas da CR_GERAL cujo documento inclui NFES, ordenadas por vencimento crescente. O filtro permite ver todos os documentos emitidos ou apenas os vencimentos do mês atual."`,
`                infoContent="Lista receitas da CR_GERAL cujo documento inclui NFES, ordenadas por vencimento crescente. Valor da Nota usa Valor total título uma única vez por título; Valor a Receber soma a coluna Valor sem repetir divisões administrativas/operacionais."`,
'Info NFES');

replaceOrFail(
`                  <tr>\n                    <th>Documento</th>\n                    <th>Projeto</th>\n                    <th>Data</th>\n                    <th style={{ textAlign: 'right' }}>Valor</th>\n                  </tr>`,
`                  <tr>\n                    <th>Documento</th>\n                    <th>Projeto</th>\n                    <th>Vencimento</th>\n                    <th style={{ textAlign: 'right' }}>Valor da Nota</th>\n                    <th style={{ textAlign: 'right' }}>Valor a Receber</th>\n                  </tr>`,
'Cabecalho NFES');

replaceOrFail(
`                    <tr key={idx}>\n                      <td style={{ fontWeight: '500' }}>{row.documento}</td>\n                      <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>\n                      <td>{row.data}</td>\n                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>\n                    </tr>`,
`                    <tr key={idx}>\n                      <td style={{ fontWeight: '500' }}>{row.documento}</td>\n                      <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>\n                      <td>{row.data}</td>\n                      <td style={{ textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(row.valorNota)}</td>\n                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>{formatCurrency(row.valorAReceber)}</td>\n                    </tr>`,
'Linhas NFES');

replaceOrFail(
`                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Nenhum faturamento encontrado.</td></tr>`,
`                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Nenhum faturamento encontrado.</td></tr>`,
'Colspan NFES');

replaceOrFail(
`                    <tr>\n                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>\n                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>\n                    </tr>`,
`                    <tr>\n                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Totais:</td>\n                      <td style={{ fontWeight: '700', color: 'var(--text-main)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalValorNotasNfes)}</td>\n                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>\n                    </tr>`,
'Rodape NFES');

fs.writeFileSync(file, src);
console.log('Painel NFES atualizado com Valor da Nota e Valor a Receber.');
