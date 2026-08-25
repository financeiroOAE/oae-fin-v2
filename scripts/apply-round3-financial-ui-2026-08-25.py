from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Trecho nao encontrado: {label}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=re.S):
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Trecho regex nao encontrado: {label} ({count})")
    return new_text


# =============================================================================
# 1. SINCRONIZACAO: ENRIQUECER LANCAMENTOS COM O PLANO FINANCEIRO OFICIAL
# =============================================================================
business_file = Path('src/lib/businessRules.js')
src = business_file.read_text(encoding='utf-8')
src = replace_once(
    src,
    "export function processSiengeData(sheetData, type, deparaMap, projectCatalog = []) {",
    "export function processSiengeData(sheetData, type, deparaMap, projectCatalog = [], financialPlanMap = {}) {",
    'assinatura processSiengeData'
)
src = replace_once(
    src,
    """      const dreInfo = deparaMap[accountCode] || {
        'DESCRIÇÃO DRE': 'PENDENTE DE CLASSIFICAÇÃO',
        'Classe Orçamentária': 'PENDENTE DE CLASSIFICAÇÃO',
        'Pacote': 'PENDENTE DE CLASSIFICAÇÃO',
        'Linha DRE': 'PENDENTE DE CLASSIFICAÇÃO'
      };""",
    """      const dreInfo = deparaMap[accountCode] || {
        'DESCRIÇÃO DRE': 'PENDENTE DE CLASSIFICAÇÃO',
        'Classe Orçamentária': 'PENDENTE DE CLASSIFICAÇÃO',
        'Pacote': 'PENDENTE DE CLASSIFICAÇÃO',
        'Linha DRE': 'PENDENTE DE CLASSIFICAÇÃO'
      };
      const financialPlan = financialPlanMap[accountCode] || {};""",
    'financial plan lookup'
)
src = replace_once(
    src,
    """        contaCodigo: accountCode,
        contaNome: contaNomeOriginal,
        contaDescricao: dreInfo['DESCRIÇÃO DRE'],""",
    """        contaCodigo: accountCode,
        contaNome: contaNomeOriginal,
        planoCodigo: String(financialPlan.CODIGO || '').trim(),
        planoFinanceiro: String(financialPlan['PLANO FINANCEIRO'] || '').trim(),
        planoCategoria: String(financialPlan.CATEGORIA || '').trim(),
        planoTipo: String(financialPlan.TIPO || '').trim(),
        contaDescricao: dreInfo['DESCRIÇÃO DRE'],""",
    'campos plano financeiro'
)
business_file.write_text(src, encoding='utf-8')

sync_file = Path('src/lib/financialSync.js')
src = sync_file.read_text(encoding='utf-8')
src = replace_once(
    src,
    """  const deparaMap = {};
  depara.forEach((row) => {
    const code = extractAccountCode(row.Conta);
    if (code) deparaMap[code] = row;
  });

  // O catálogo oficial é usado tanto no CP quanto no CR para padronizar o nome da obra.
  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos);
  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos);""",
    """  const deparaMap = {};
  depara.forEach((row) => {
    const code = extractAccountCode(row.Conta);
    if (code) deparaMap[code] = row;
  });

  const planosMap = {};
  planos.forEach((row) => {
    const code = String(row.ID || '').replace(/\\D/g, '') || extractAccountCode(row['PLANO FINANCEIRO']);
    if (code) planosMap[code] = row;
  });

  // O catálogo oficial é usado tanto no CP quanto no CR para padronizar o nome da obra.
  // PLANOS_FINANCEIROS acompanha cada lançamento para auditoria das pendências da DRE.
  const cpProcessed = processSiengeData(cpGeralRaw, 'CP_GERAL', deparaMap, projetos, planosMap);
  const crProcessed = processSiengeData(crGeralRaw, 'CR_GERAL', deparaMap, projetos, planosMap);""",
    'mapa planos financeiros'
)
sync_file.write_text(src, encoding='utf-8')


# =============================================================================
# 2. DRE: SINCRONIZACAO REAL, SUBGRUPOS DO PDF E PENDENCIAS RESUMIDAS
# =============================================================================
dre_file = Path('src/app/dre/page.js')
src = dre_file.read_text(encoding='utf-8')

# Drawer especifico das pendencias: primeiro resumo por plano, depois movimentos.
pending_component = r'''
function getPendingReason(item) {
  const classe = String(item.dreClasse || '').toUpperCase();
  const linha = String(item.dreLinha || '').toUpperCase();
  if (!item.contaCodigo) return 'Conta financeira não identificada no lançamento.';
  if (!item.planoFinanceiro) return 'Conta não encontrada na relação PLANOS_FINANCEIROS.';
  if (classe.includes('PENDENTE') || linha.includes('PENDENTE')) return 'O plano financeiro existe, mas não possui DEPARA válido para a DRE.';
  return 'O DEPARA existe, mas a classe/linha informada não corresponde a uma linha reconhecida da DRE.';
}

function PendingClassificationDrawer({ items, onClose }) {
  const summary = Object.values((items || []).reduce((map, item) => {
    const code = String(item.contaCodigo || '').trim() || 'SEM-CODIGO';
    const plan = String(item.planoFinanceiro || '').trim() || `${code} - ${item.contaNome || item.contaDescricao || 'Plano não identificado'}`;
    const nomenclature = item.contaNome || item.contaDescricao || 'Sem nomenclatura';
    const reason = getPendingReason(item);
    const key = `${code}|${plan}|${reason}`;
    if (!map[key]) map[key] = { code, plan, nomenclature, reason, total: 0, count: 0 };
    map[key].total += Math.abs(Number(item.valor) || 0);
    map[key].count += 1;
    return map;
  }, {})).sort((a, b) => a.total - b.total || a.plan.localeCompare(b.plan, 'pt-BR'));

  const detailRows = [...(items || [])].sort((a, b) => Math.abs(Number(a.valor) || 0) - Math.abs(Number(b.valor) || 0));
  const total = summary.reduce((sum, row) => sum + row.total, 0);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2147483400, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1100px, 100vw)', height: '100vh', background: 'var(--bg-main)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '-18px 0 44px rgba(0,0,0,0.45)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Pendências de Classificação</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Resumo por plano financeiro, do menor para o maior valor. Total fora da DRE: <strong style={{ color: 'var(--warning)' }}>{fmt(total)}</strong>.</p>
          </div>
          <button type="button" className="btn" onClick={onClose} style={{ padding: '0.4rem', background: 'transparent', border: 0 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Resumo por plano financeiro</strong>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '900px', fontSize: '12px' }}>
                <thead><tr><th>Plano Financeiro</th><th>Nomenclatura</th><th>Por que não entra na DRE</th><th style={{ textAlign: 'center' }}>Lanç.</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={`${row.code}-${row.plan}`}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px' }}>{row.plan}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.nomenclature}</td>
                      <td style={{ color: 'var(--warning)', maxWidth: '360px' }}>{row.reason}</td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Lançamentos que compõem as pendências</strong>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Detalhamento abaixo para auditoria e ajuste do DEPARA.</p>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '48vh', overflowY: 'auto' }}>
              <table style={{ minWidth: '1050px', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}><tr><th>Data</th><th>Projeto</th><th>Plano Financeiro</th><th>Nomenclatura</th><th>Nome</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {detailRows.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.data || '—'}</td>
                      <td>{item.projeto || '—'}</td>
                      <td>{item.planoFinanceiro || item.contaCodigo || '—'}</td>
                      <td>{item.contaNome || item.contaDescricao || '—'}</td>
                      <td>{item.nome || '—'}</td>
                      <td>{item.status || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Math.abs(Number(item.valor) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'''
src = replace_once(src, '// ─── Linha de Resultado Calculado ─────────────────────────────────────────────', pending_component + '// ─── Linha de Resultado Calculado ─────────────────────────────────────────────', 'pending drawer component')

# Hierarquia visual conforme PDF: Equipe antes de C.D.P.; assessorias em bloco próprio.
helper_pattern = r'''const accountSection = \(label\) => \{.*?\n\};\n\nconst sortAccounts = \(accounts\) => Object\.values\(accounts \|\| \{\}\)\.sort\(\(a, b\) => \{.*?\n\}\);'''
helper_new = r'''const normalizeAccountLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const accountSubgroup = (groupId, label) => {
  const text = normalizeAccountLabel(label);
  if (groupId === 'CUSTOS_SERVICOS') {
    if (text.includes('EQUIP.') || text.includes('EQUIPE')) return { key: 'EQUIPE', label: 'CUSTOS / EQUIPE TÉCNICA', order: 0 };
    if (text.includes('C.D.P') || text.includes('CDP')) return { key: 'CDP', label: 'CUSTOS / PROJETOS', order: 1 };
    return { key: 'OUTROS_CUSTOS', label: 'OUTROS CUSTOS DOS SERVIÇOS', order: 2 };
  }
  if (groupId === 'DESP_ADM') {
    if (text.includes('ASSESSORIA') || text.includes('CONSULTORIA EM TI') || text.includes('SERVICOS ESPECIALIZADOS')) {
      return { key: 'ASSESSORIAS', label: 'DESPESAS COM ASSESSORIAS E SERVIÇOS', order: 1 };
    }
    return { key: 'ADM', label: 'DESPESAS ADMINISTRATIVAS', order: 0 };
  }
  return { key: 'CONTAS', label: null, order: 0 };
};

const accountSection = (label) => {
  const text = normalizeAccountLabel(label);
  if (text.includes('EQUIP.') || text.includes('EQUIPE')) return 'EQUIPE';
  if (text.includes('C.D.P') || text.includes('CDP')) return 'CDP';
  return 'OUTRO';
};

const sortAccounts = (accounts, groupId = '') => Object.values(accounts || {}).sort((a, b) => {
  const sectionA = accountSubgroup(groupId, a.label);
  const sectionB = accountSubgroup(groupId, b.label);
  if (sectionA.order !== sectionB.order) return sectionA.order - sectionB.order;
  return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true });
});

function DreSubgroupRow({ label, accounts, meses, showMonths }) {
  const total = accounts.reduce((sum, account) => sum + (account.total || 0), 0);
  const byMonth = Object.fromEntries(meses.map((month) => [month.key, accounts.reduce((sum, account) => sum + (account.byMonth?.[month.key] || 0), 0)]));
  return (
    <tr style={{ background: 'rgba(57,198,198,0.055)', borderTop: '3px solid var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '0.7rem 1rem 0.7rem 2.6rem', position: 'sticky', left: 0, zIndex: 1, background: 'rgba(10,38,65,0.99)', color: 'var(--primary)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.045em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</td>
      {showMonths && meses.map((month) => <td key={month.key} style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{byMonth[month.key] ? fmt(byMonth[month.key]) : '—'}</td>)}
      <td style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'var(--text-main)', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', background: 'rgba(15,23,42,0.6)' }}>{fmt(total)}</td>
    </tr>
  );
}

function renderSubgroupedAccounts(accounts, groupId, meses, showMonths, onAccountClick, paddingLeft = '3rem') {
  const sorted = sortAccounts(accounts, groupId);
  const rows = [];
  let previousKey = null;

  sorted.forEach((account, idx) => {
    const subgroup = accountSubgroup(groupId, account.label);
    if (subgroup.label && subgroup.key !== previousKey) {
      const subgroupAccounts = sorted.filter((candidate) => accountSubgroup(groupId, candidate.label).key === subgroup.key);
      rows.push(<DreSubgroupRow key={`${groupId}-${subgroup.key}-header`} label={subgroup.label} accounts={subgroupAccounts} meses={meses} showMonths={showMonths} />);
    }
    rows.push(<DreAccountRow key={`${groupId}-acc-${idx}`} account={account} meses={meses} showMonths={showMonths} onAccountClick={onAccountClick} paddingLeft={paddingLeft} />);
    previousKey = subgroup.key;
  });
  return rows;
}'''
src = sub_once(src, helper_pattern, lambda _: helper_new, 'helpers subgrupos DRE')

src = src.replace('const accounts = sortAccounts(groupData.accounts);', 'const accounts = sortAccounts(groupData.accounts, groupDef.id);')
src = src.replace('const subAccounts = sortAccounts(subData.accounts);', 'const subAccounts = sortAccounts(subData.accounts, subId);')

compound_rows_pattern = r'''            const accountRows = subAccounts\.map\(\(account, idx\) => \(\n              <DreAccountRow.*?\n            \)\);'''
compound_rows_new = """            const accountRows = renderSubgroupedAccounts(subAccounts, subId, meses, showMonths, onAccountClick, '4.5rem');"""
src = sub_once(src, compound_rows_pattern, lambda _: compound_rows_new, 'subgroup account rows compound')

noncompound_pattern = r'''        \) : \(\n          accounts\.map\(\(account, idx\) => \(\n            <DreAccountRow.*?\n          \)\)\n        \)'''
noncompound_new = """        ) : (
          renderSubgroupedAccounts(accounts, groupDef.id, meses, showMonths, onAccountClick)
        )"""
src = sub_once(src, noncompound_pattern, lambda _: noncompound_new, 'subgroup account rows normal')

# Report builder respeita a mesma ordem.
src = src.replace('sortAccounts(subGroup.accounts).forEach', 'sortAccounts(subGroup.accounts, subId).forEach')
src = src.replace('sortAccounts(groupData?.accounts).forEach', 'sortAccounts(groupData?.accounts, groupDef.id).forEach')

# Sincronizacao manual deve realmente forcar a leitura da planilha.
fetch_pattern = r'''  const fetchDados = async \(\) => \{.*?\n  \};'''
fetch_new = '''  const fetchDados = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch(force ? "/api/sync?force=1" : "/api/sync", { method: 'GET', cache: 'no-store' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.details?.message || "Erro desconhecido");
      setData(result.data || []);
      setProjetosBrutos(result.projetos || []);
      const syncDate = result.syncedAt || result.snapshotAt;
      setLastSync(syncDate ? new Date(syncDate).toLocaleString("pt-BR") : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };'''
src = sub_once(src, fetch_pattern, lambda _: fetch_new, 'fetch DRE force')
src = src.replace('onClick={fetchDados}\n            disabled={isSyncing}', 'onClick={() => fetchDados(true)}\n            disabled={isSyncing}')

# Estado do drawer de pendencias.
src = replace_once(
    src,
    '  const [auditDrawer, setAuditDrawer] = useState(null); // { items, title }',
    '  const [auditDrawer, setAuditDrawer] = useState(null); // { items, title }\n  const [pendingDrawerOpen, setPendingDrawerOpen] = useState(false);',
    'state pending drawer'
)

# Pending report com contexto do plano e motivo.
old_pending_rows = '''  const drePendingRows = useMemo(() => dreData.naoClassificados.items.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    Conta: item.contaNome || item.contaDescricao,
    Nome: item.nome,
    Situação: item.status,
    Valor: Math.abs(item.valor || 0),
  })), [dreData.naoClassificados.items]);'''
new_pending_rows = '''  const drePendingRows = useMemo(() => dreData.naoClassificados.items.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    "Plano Financeiro": item.planoFinanceiro || item.contaCodigo || 'Não identificado',
    Nomenclatura: item.contaNome || item.contaDescricao,
    Motivo: getPendingReason(item),
    Nome: item.nome,
    Situação: item.status,
    Valor: Math.abs(item.valor || 0),
  })).sort((a, b) => a.Valor - b.Valor), [dreData.naoClassificados.items]);'''
src = replace_once(src, old_pending_rows, new_pending_rows, 'pending report rows')

src = src.replace(
    'Existem {dreData.naoClassificados.items.length} lançamentos que não foram classificados na DRE (sem DEPARA). Eles <strong>NÃO</strong> estão somando no resultado acima.',
    'Existem {dreData.naoClassificados.items.length} lançamentos sem DEPARA válido ou sem linha DRE reconhecida. Eles <strong>NÃO</strong> estão somando no resultado acima.'
)
src = src.replace(
    'onClick={() => setAuditDrawer({ items: dreData.naoClassificados.items, title: "Lançamentos Não Classificados" })}',
    'onClick={() => setPendingDrawerOpen(true)}'
)
src = src.replace(
    '      {/* ── Audit Drawer ── */}\n      {auditDrawer && <AuditDrawer items={auditDrawer.items} title={auditDrawer.title} onClose={() => setAuditDrawer(null)} />}',
    '      {/* ── Drawers de Auditoria ── */}\n      {pendingDrawerOpen && <PendingClassificationDrawer items={dreData.naoClassificados.items} onClose={() => setPendingDrawerOpen(false)} />}\n      {auditDrawer && <AuditDrawer items={auditDrawer.items} title={auditDrawer.title} onClose={() => setAuditDrawer(null)} />}'
)

dre_file.write_text(src, encoding='utf-8')


# =============================================================================
# 3. PROJETOS: DATAS, CAIXA, EQUIPE POR CONTA E GRAFICO ANUAL
# =============================================================================
project_file = Path('src/app/projetos/page.js')
src = project_file.read_text(encoding='utf-8')
src = src.replace('import RankingBarChart from "@/components/charts/RankingBarChart";', 'import RankingBarChart from "@/components/charts/RankingBarChart";\nimport ProjectMonthlyFinancialLineChart from "@/components/charts/ProjectMonthlyFinancialLineChart";')
src = src.replace("return { start: `${today.getFullYear()}-01-01`, end: localDate(today) };", "return { start: '2026-01-01', end: localDate(today) };")
src = src.replace("setLastSync(new Date().toLocaleString('pt-BR'));", "const syncDate = result.syncedAt || result.snapshotAt;\n      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);")
src = src.replace('Recebido no período (Obra + ADM)', 'Recebido no período')
src = src.replace('Pago em 2026', 'Pago no período')

team_pattern = r'''  const teamCostsChartData = useMemo\(\(\) => \{.*?\n  \}, \[data, filteredProjetos, dIni, dFim\]\);'''
team_new = '''  const teamCostsChartData = useMemo(() => {
    const allowedProjects = new Set(filteredProjetos.map(p => p.projectKey));
    const map = {};

    data.forEach(item => {
      if (item.natureza !== 'Saída' || !isTeamExpense(item)) return;
      if (!allowedProjects.has(getProjectKey(item.projeto))) return;

      let ts = 0;
      if (item.data) {
        const parts = String(item.data).split('/');
        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      if (ts < dIni || ts > dFim) return;

      const status = String(item.status || '').toUpperCase();
      const validStatus = status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO') || status.includes('A REALIZAR') || status.includes('A PAGAR') || status.includes('PREVISTO');
      if (!validStatus) return;

      const account = item.contaNome || item.contaDescricao || item.contaCodigo || 'Equipe não identificada';
      map[account] = (map[account] || 0) + Math.abs(Number(item.valor) || 0);
    });

    return Object.entries(map)
      .map(([nome, Valor]) => ({ nome, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [data, filteredProjetos, dIni, dFim]);

  const monthlyFinancialData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const rows = months.map((mes, index) => ({ mes, month: index, Receitas: 0, Custos: 0, Despesas: 0 }));
    const allowedProjects = new Set(filteredProjetos.map((project) => project.projectKey));

    projectCashData.forEach((item) => {
      if (item.natureza !== 'Entrada' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('RECEBIDO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      const originalRows = item.linhasOriginais?.length ? item.linhasOriginais : [item];
      const revenue = originalRows.reduce((sum, row) => {
        const classification = classifyFinancialEntry(row);
        return (classification.type === 'receita_projeto' || classification.type === 'receita_administrativa') ? sum + (Number(row.valor) || 0) : sum;
      }, 0);
      rows[month].Receitas += revenue;
    });

    data.forEach((item) => {
      if (item.natureza !== 'Saída' || !allowedProjects.has(getProjectKey(item.projeto))) return;
      if (String(item.projeto || '').toUpperCase().includes('ADMINISTRA')) return;
      const status = String(item.status || '').toUpperCase();
      if (!(status.includes('REALIZADO') || status.includes('PAGO') || status.includes('EFETIVADO'))) return;
      const parts = String(item.data || '').split('/');
      if (parts.length !== 3 || parts[2] !== '2026') return;
      const month = Number(parts[1]) - 1;
      if (month < 0 || month > 11) return;
      if (isRevenueTax(item)) return;

      const dreText = [item.dreClasse, item.dreLinha, item.dreDescricao].filter(Boolean).join(' ').toUpperCase();
      if (!dreText || dreText.includes('PENDENTE DE CLASSIFICAÇÃO')) return;
      const value = Math.abs(Number(item.valor) || 0);
      if (dreText.includes('CUSTO')) rows[month].Custos += value;
      else rows[month].Despesas += value;
    });

    return rows;
  }, [data, filteredProjetos, projectCashData]);'''
src = sub_once(src, team_pattern, lambda _: team_new, 'equipe por conta + mensal')

src = src.replace('Custos e compromissos de equipe vinculados aos projetos/obras no período selecionado.', 'Contas EQUIP. TÉC. somadas nos projetos exibidos. Ao filtrar uma obra, os valores passam a representar somente aquela obra.')
src = src.replace('emptyMessage="Sem custos de equipe identificados para os projetos filtrados."', 'emptyMessage="Sem contas de equipe identificadas para os projetos filtrados."')

annual_card = '''
      <div id="report-projetos-evolucao-anual" data-report-section className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Evolução Financeira dos Projetos — 2026</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Receitas, custos e despesas realizados por mês. Os filtros de projeto, empresa e tipo continuam válidos.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ReportAdder sectionKey="projetos:evolucao-anual" title="Evolução Financeira dos Projetos — 2026" componentName="Gráfico de Evolução Financeira" page="Projetos" type="CHART" data={monthlyFinancialData} filters={reportFilters} captureId="report-projetos-evolucao-anual" presetTags={["project-executive"]} />
            <InfoTooltip title="Evolução Financeira 2026" content="Linha mensal dos valores realizados: receitas de projetos, custos dos serviços e demais despesas vinculadas às obras. Tributos são exibidos separadamente na composição financeira e não são somados como despesas nesta linha." />
          </div>
        </div>
        <ProjectMonthlyFinancialLineChart data={monthlyFinancialData} />
      </div>

'''
src = replace_once(src, '      {/* 6. Gráficos Analíticos */}', annual_card + '      {/* 6. Gráficos Analíticos */}', 'grafico anual antes ABC')

# Evitar cards esticados gerando vazios artificiais.
src = src.replace("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem'", "gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1rem', marginBottom: '2rem', alignItems: 'start'")
project_file.write_text(src, encoding='utf-8')


# =============================================================================
# 4. FLUXO DE CAIXA: RESULTADO COMO LINHA E STATUS ANUAL CORRETO
# =============================================================================
flow_file = Path('src/app/fluxo-caixa/page.js')
src = flow_file.read_text(encoding='utf-8')
src = src.replace('BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Cell', 'BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Cell')
src = src.replace("setLastSync(new Date().toLocaleString('pt-BR'));", "const syncDate = result.syncedAt || result.snapshotAt;\n      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);")
src = src.replace("meses.forEach((m, i) => map[i] = { mesNome: m, Recebido: 0, 'A receber': 0, Pago: 0, Resultado: 0, id: i });", "meses.forEach((m, i) => map[i] = { mesNome: m, Recebido: 0, 'A receber': 0, Pago: 0, 'A pagar': 0, Resultado: 0, id: i });")
src = replace_once(
    src,
    """          if (item.natureza === 'Saída') {
            map[m].Pago += item.valor;
            map[m].Resultado -= item.valor;
          }""",
    """          if (item.natureza === 'Saída') {
            if (isPrevisto) map[m]['A pagar'] += item.valor;
            else map[m].Pago += item.valor;
            map[m].Resultado -= item.valor;
          }""",
    'a pagar anual'
)
src = src.replace('Mostra, por mês de 2026, o que já foi recebido, o que ainda está a receber, o que foi pago e o resultado financeiro. Esta visão anual não é cortada pelo filtro de datas da página.', 'Mostra, por mês de 2026, Recebido, A receber, Pago e A pagar. A linha Resultado liga o saldo de cada mês: (Recebido + A receber) - (Pago + A pagar). Esta visão anual não é cortada pelo filtro de datas da página.')
src = replace_once(src, '<BarChart data={annualData2026} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>', '<ComposedChart data={annualData2026} margin={{ top: 10, right: 18, left: 10, bottom: 0 }}>', 'annual composed start')
src = replace_once(src, '<Bar dataKey="Pago" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={50} />\n              <Bar dataKey="Resultado" fill="var(--info)" radius={[4, 4, 0, 0]} maxBarSize={50} />\n            </BarChart>', '<Bar dataKey="Pago" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={42} />\n              <Bar dataKey="A pagar" fill="var(--warning)" radius={[4, 4, 0, 0]} maxBarSize={42} />\n              <Line type="monotone" dataKey="Resultado" stroke="var(--info)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />\n            </ComposedChart>', 'annual composed end')
flow_file.write_text(src, encoding='utf-8')


# =============================================================================
# 5. VISAO FINANCEIRA: EXPLICAR E DEFINIR REALIZADO X PREVISTO
# =============================================================================
view_file = Path('src/app/visao-financeira/page.js')
src = view_file.read_text(encoding='utf-8')
src = src.replace('import MultiSelect from "@/components/MultiSelect";', 'import MultiSelect from "@/components/MultiSelect";\nimport InfoTooltip from "@/components/InfoTooltip";')
src = src.replace("setLastSync(new Date().toLocaleString('pt-BR'));", "const syncDate = result.syncedAt || result.snapshotAt;\n      setLastSync(syncDate ? new Date(syncDate).toLocaleString('pt-BR') : null);")

realized_pattern = r'''  const realizedFilteredData = useMemo\(\(\) => filteredData\.filter\(item =>\n    String\(item\.status \|\| ''\)\.trim\(\)\.toUpperCase\(\) === 'REALIZADO'\n  \), \[filteredData\]\);'''
realized_new = '''  const realizedFilteredData = useMemo(() => {
    const start = filterDataInicial ? new Date(filterDataInicial + 'T00:00:00').getTime() : 0;
    const selectedEnd = filterDataFinal ? new Date(filterDataFinal + 'T23:59:59').getTime() : Infinity;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const end = Math.min(selectedEnd, todayEnd.getTime());
    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'REALIZADO') return false;
      return item.dataTimestamp >= start && item.dataTimestamp <= end;
    });
  }, [openFilteredData, filterDataInicial, filterDataFinal]);

  const forecastFilteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOf2026 = new Date('2026-12-31T23:59:59').getTime();
    return openFilteredData.filter((item) => {
      if (String(item.status || '').trim().toUpperCase() !== 'A REALIZAR') return false;
      return item.dataTimestamp >= today.getTime() && item.dataTimestamp <= endOf2026;
    });
  }, [openFilteredData]);'''
src = sub_once(src, realized_pattern, lambda _: realized_new, 'realized/forecast view')

src = src.replace("const entradasARealizar = openFilteredData.filter(r => r.natureza === 'Entrada' && String(r.status || '').trim().toUpperCase() === 'A REALIZAR').reduce((acc, r) => acc + r.valor, 0);", "const entradasARealizar = forecastFilteredData.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);")
src = src.replace("const saidasARealizar = openFilteredData.filter(r => r.natureza === 'Saída' && String(r.status || '').trim().toUpperCase() === 'A REALIZAR').reduce((acc, r) => acc + r.valor, 0);", "const saidasARealizar = forecastFilteredData.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);")
src = src.replace("accumulate(openFilteredData.filter((item) => String(item.status || '').trim().toUpperCase() === 'A REALIZAR'), 'pendente');", "accumulate(forecastFilteredData, 'pendente');")
src = src.replace('}, [realizedFilteredData, openFilteredData]);', '}, [realizedFilteredData, forecastFilteredData]);')

old_realized_title = '''          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><CheckCircle size={16} color="var(--primary)"/> Resultado Realizado</p>'''
new_realized_title = '''          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><CheckCircle size={16} color="var(--primary)"/> Resultado Realizado <InfoTooltip title="Resultado Realizado" content="Entradas realizadas menos saídas realizadas entre a Data Inicial e a menor entre Data Final e hoje. No período padrão: 01/01/2026 até hoje." /></p>'''
src = replace_once(src, old_realized_title, new_realized_title, 'info resultado realizado')
old_forecast_title = '''          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Target size={16} color="var(--primary)"/> Resultado Previsto</p>'''
new_forecast_title = '''          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600' }}><Target size={16} color="var(--primary)"/> Resultado Previsto <InfoTooltip title="Resultado Previsto" content="A receber menos A pagar dos lançamentos ainda A realizar, com vencimento de hoje até 31/12/2026. Os filtros de projeto, nome e conta continuam válidos." /></p>'''
src = replace_once(src, old_forecast_title, new_forecast_title, 'info resultado previsto')
view_file.write_text(src, encoding='utf-8')


# =============================================================================
# 6. UI: AUTO-I NAO COBRE BOTOES; DROPDOWN SEMPRE NO TOPO; CARDS NAO SOBEM
# =============================================================================
ui_file = Path('src/components/UiEnhancements.jsx')
src = ui_file.read_text(encoding='utf-8')
src = replace_once(
    src,
    """  if (card.querySelector('.info-tooltip-container')) return false;
  if (card.querySelector('input, select, textarea')) return false;""",
    """  if (card.querySelector('.info-tooltip-container')) return false;
  // Não inserir o i automático em cards que já têm controles/ícones acionáveis no cabeçalho.
  // Isso evita sobreposição com ReportAdder, expandir, fechar, filtros e outros botões.
  if (card.querySelector('button, [role="button"], a, input, select, textarea')) return false;""",
    'auto help avoid controls'
)
ui_file.write_text(src, encoding='utf-8')

multi_file = Path('src/components/MultiSelect.js')
src = multi_file.read_text(encoding='utf-8')
src = src.replace('zIndex: 2147482500,', 'zIndex: 2147483646,')
src = src.replace("boxShadow: '0 18px 40px rgba(0,0,0,0.48)',", "boxShadow: '0 22px 48px rgba(0,0,0,0.58)',\n        isolation: 'isolate',")
multi_file.write_text(src, encoding='utf-8')

css_file = Path('src/app/ui-fixes.css')
src = css_file.read_text(encoding='utf-8')
if '.card:hover {' not in src:
    src += '''\n\n/* Cards financeiros não criam nova camada ao passar o mouse; dropdowns e tooltips permanecem acima. */\n.card:hover {\n  transform: none;\n}\n'''
css_file.write_text(src, encoding='utf-8')

print('Rodada 3 aplicada com sucesso.')
