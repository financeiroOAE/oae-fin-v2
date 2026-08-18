const fs = require('fs');
let p = fs.readFileSync('src/app/projetos/page.js', 'utf8');

const target = '          <RankingBarChart data={topSaidasData} dataKey="Valor" color="var(--danger)" emptyMessage="Sem pagamentos realizados em 2026." />\n        </div>';

const impostosChartCard = `
        {/* Impostos sobre Faturamento */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: '1 1 400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Impostos sobre Faturamento</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Total de Impostos: <strong style={{color:'var(--text-main)'}}>{formatCurrency(taxesData.total)}</strong> ({taxPercentage.toFixed(2).replace('.', ',')}% sobre o faturamento)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ReportAdder sectionKey="projetos:impostos-chart" title="Impostos sobre Faturamento" componentName="Gráfico Impostos" page="Projetos" type="TABLE" data={taxesData.list} filters={reportFilters} presetTags={["project-executive"]} />
              <InfoTooltip title="Impostos sobre Notas Fiscais" content={<><p>Mostra os tributos e retenções associados ao faturamento.</p></>} />
            </div>
          </div>
          <RankingBarChart data={taxesData.list} dataKey="Valor" color="var(--primary)" emptyMessage="Sem impostos registrados no período." onClickItem={(cat) => setTaxDrillDown && setTaxDrillDown(cat.name)} />
        </div>
`;

p = p.replace(target, target + '\n' + impostosChartCard);
fs.writeFileSync('src/app/projetos/page.js', p);
