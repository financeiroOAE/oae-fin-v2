const fs = require('fs');

const file = 'src/app/fluxo-caixa/page.js';
let src = fs.readFileSync(file, 'utf8');

function replaceOrFail(search, replacement, label) {
  if (!src.includes(search)) throw new Error(`Trecho nao encontrado: ${label}`);
  src = src.replace(search, replacement);
}

// Remove a explicacao fixa adicionada ao Fluxo de Caixa.
replaceOrFail(
`      <div style={{ margin: '-0.5rem 0 1.25rem', padding: '0.75rem 0.9rem', borderLeft: '3px solid var(--primary)', background: 'var(--bg-elevated)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text-main)' }}>Como ler Entradas:</strong> este total representa dinheiro entrando no caixa e pode conter receita operacional, empréstimos/financiamentos, aportes e outras movimentações. Entrada de caixa não é automaticamente receita.
      </div>

`,
'',
'Como ler Entradas do Fluxo'
);

replaceOrFail(
`  // Novos blocos analíticos (Dia e Faturamento)
  const faturamentosNfes = useMemo(() => {
    const rawList = baseData.filter(item =>
      item.natureza === 'Entrada' &&
      item.statusExibicao === 'A receber' &&
      item.documento &&
      item.documento.toUpperCase().includes('NFES')
    );

    // Agregação por Título / Documento (consolida a divisão ADM/Operacional)
    const map = {};
    rawList.forEach(item => {
      const key = item.documento || item.nome || item.lancamento;
      if (!map[key]) {
        map[key] = { ...item };
      } else {
        map[key].valor += item.valor;
        // Se a nova linha tem um projeto válido não-adm, sobrescrevemos o projeto adm
        const isCurrentAdm = map[key].projeto && map[key].projeto.toUpperCase().includes('ADMINISTRA');
        const isNewAdm = item.projeto && item.projeto.toUpperCase().includes('ADMINISTRA');

        if (isCurrentAdm && !isNewAdm && item.projeto) {
          map[key].projeto = item.projeto;
        }
      }
    });
    return Object.values(map).sort((a, b) => b.dataTimestamp - a.dataTimestamp);
  }, [baseData]);`,
`  // Novos blocos analíticos (Dia e Faturamento)
  const faturamentosNfes = useMemo(() => {
    const rawList = baseData.filter(item =>
      item.natureza === 'Entrada' &&
      item.statusExibicao === 'A receber' &&
      item.documento &&
      item.documento.toUpperCase().includes('NFES')
    );

    // A NF pode vir dividida entre faturamento operacional e administrativo.
    // O Valor exibido continua seguindo a regra atual; o Valor Real da NF usa
    // Valor total titulo apenas uma vez, sem somar a divisao ADM/operacional.
    const map = {};
    rawList.forEach(item => {
      const key = String(item.lancamento || 'SEM-LANCAMENTO') + '|' + String(item.documento || item.nome || 'SEM-DOCUMENTO');
      const linhas = Array.isArray(item.linhasOriginais) && item.linhasOriginais.length
        ? item.linhasOriginais
        : [item];

      const valoresReais = [
        Number(item.valorTotalTitulo) || 0,
        ...linhas.map(linha => Number(linha.valorTotalTitulo) || 0),
      ].filter(valor => valor > 0);

      const projetoObra = linhas
        .map(linha => String(linha.projeto || '').trim())
        .find(projeto => {
          const upper = projeto.toUpperCase();
          return projeto && !upper.includes('ADMINISTRA') && upper !== 'GRUPO OAE' && upper !== 'SEM PROJETO';
        }) || item.projeto;

      const dataEmissao = String(item.dataEmissao || '').trim();
      const valorRealNota = valoresReais.length ? Math.max(...valoresReais) : 0;

      if (!map[key]) {
        map[key] = {
          ...item,
          projeto: projetoObra,
          dataEmissao,
          valorRealNota,
        };
      } else {
        map[key].valor += Number(item.valor) || 0;
        map[key].valorRealNota = Math.max(map[key].valorRealNota || 0, valorRealNota);
        if (!map[key].dataEmissao && dataEmissao) map[key].dataEmissao = dataEmissao;
        if ((!map[key].projeto || String(map[key].projeto).toUpperCase().includes('ADMINISTRA')) && projetoObra) {
          map[key].projeto = projetoObra;
        }
      }
    });
    return Object.values(map).sort((a, b) => b.dataTimestamp - a.dataTimestamp);
  }, [baseData]);`
, 'agregacao NFES');

replaceOrFail(
`  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);`,
`  const totalFaturamentosNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + row.valor, 0);
  const totalValorRealNfes = faturamentosNfesFiltrados.reduce((acc, row) => acc + (Number(row.valorRealNota) || 0), 0);`,
'Total Valor Real NFES');

replaceOrFail(
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />`,
`            <ReportAdder sectionKey="fluxo:faturamento-nfes" title="Painel de Faturamento (NFES)" componentName="Tabela de Faturamentos" page="Fluxo de Caixa" type="TABLE" data={faturamentosNfesFiltrados.map(row => ({ Documento: row.documento, Projeto: row.projeto, Data: row.data, Valor: row.valor, "Data de Emissão": row.dataEmissao || '', "Valor Real da Nota Fiscal": row.valorRealNota }))} filters={{ Tipo: "NFES", Situação: "A receber" }} style={{ float: 'right' }} />`,
'ReportAdder NFES');

replaceOrFail(
`                infoContent="Lista receitas da CR_GERAL cujo documento inclui NFES, ordenadas por vencimento crescente. O filtro permite ver todos os documentos emitidos ou apenas os vencimentos do mês atual."`,
`                infoContent="Lista receitas da CR_GERAL cujo documento inclui NFES. Projeto segue o centro de custo/obra. Valor permanece conforme a regra atual e Valor Real da Nota Fiscal usa Valor total título sem duplicar a divisão administrativa/operacional. A Data de Emissão será exibida quando essa informação estiver disponível na fonte."`,
'Info NFES');

replaceOrFail(
`                  <tr>
                    <th>Documento</th>
                    <th>Projeto</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>`,
`                  <tr>
                    <th>Documento</th>
                    <th>Projeto</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Data de Emissão</th>
                    <th style={{ textAlign: 'right' }}>Valor Real da Nota Fiscal</th>
                  </tr>`,
'Cabecalho NFES');

replaceOrFail(
`                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{row.documento}</td>
                      <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>
                      <td>{row.data}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>
                    </tr>`,
`                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{row.documento}</td>
                      <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>
                      <td>{row.data}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.valor)}</td>
                      <td>{row.dataEmissao || '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatCurrency(row.valorRealNota)}</td>
                    </tr>`,
'Linhas NFES');

replaceOrFail(
`                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Nenhum faturamento encontrado.</td></tr>`,
`                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Nenhum faturamento encontrado.</td></tr>`,
'Colspan NFES');

replaceOrFail(
`                    <tr>
                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>
                    </tr>`,
`                    <tr>
                      <td colSpan="3" style={{ fontWeight: '600', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>Total:</td>
                      <td style={{ fontWeight: '700', color: 'var(--success)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalFaturamentosNfes)}</td>
                      <td style={{ borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}></td>
                      <td style={{ fontWeight: '700', color: 'var(--text-main)', textAlign: 'right', borderTop: '2px solid var(--border-color)', padding: '0.5rem' }}>{formatCurrency(totalValorRealNfes)}</td>
                    </tr>`,
'Rodape NFES');

fs.writeFileSync(file, src);
console.log('Fluxo limpo e Painel NFES atualizado sem alterar colunas existentes.');
