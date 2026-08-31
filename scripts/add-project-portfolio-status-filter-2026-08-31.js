const fs = require('fs');

const pagePath = 'src/app/projetos/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

function replaceOnce(before, after, label) {
  if (!page.includes(before)) throw new Error(`Trecho nao encontrado: ${label}`);
  page = page.replace(before, after);
}

replaceOnce(
  'import { getProjectKey, isProjectOngoing, getActiveProjectNames, isGeneralProjectsBucket } from "@/lib/projectRules";',
  'import { getProjectKey, isGeneralProjectsBucket } from "@/lib/projectRules";',
  'imports de projectRules'
);

replaceOnce(
  '  const [filterTipos, setFilterTipos] = useState([]);',
  '  const [filterTipos, setFilterTipos] = useState([]);\n  const [filterStatusProjeto, setFilterStatusProjeto] = useState(\'TODOS\');',
  'estado do filtro de status'
);

replaceOnce(
  "      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO') || !isProjectOngoing(p)) return;",
  "      if (!nomeObra || nomeObra.toUpperCase().includes('ADMINISTRATIVO')) return;",
  'inclusao dos projetos concluidos na carteira'
);

replaceOnce(
  '      percentFaturado: p.contratado > 0 ? p.faturado / p.contratado : 0,\n      resultadoCaixa: p.recebido - p.pago,',
  "      percentFaturado: p.contratado > 0 ? p.faturado / p.contratado : 0,\n      statusProjeto: p.contratado > 0 && p.faturado >= p.contratado ? 'CONCLUIDO' : 'EM_ANDAMENTO',\n      resultadoCaixa: p.recebido - p.pago,",
  'status calculado por faturamento'
);

replaceOnce(
  '    return projetosCruzados.filter(p => {\n      if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;',
  "    return projetosCruzados.filter(p => {\n      if (filterStatusProjeto !== 'TODOS' && p.statusProjeto !== filterStatusProjeto) return false;\n      if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;",
  'aplicacao do status em filteredProjetos'
);

replaceOnce(
  '  }, [projetosCruzados, filterProjetos, filterEmpresas, filterTipos, colFilterProjeto, colFilterEmpresa, colFilterMinFaturadoPerc]);',
  '  }, [projetosCruzados, filterStatusProjeto, filterProjetos, filterEmpresas, filterTipos, colFilterProjeto, colFilterEmpresa, colFilterMinFaturadoPerc]);',
  'dependencias de filteredProjetos'
);

replaceOnce(
  "  // Regra oficial dos filtros de Projetos: exibir os nomes da relação PROJETOS_2026 / centro de custo, sem códigos financeiros P.xxx e sem duplicidade.\n  const listaProjetos = getActiveProjectNames(projetosBrutos, true);\n  const listaEmpresas = Array.from(new Set(projetosCruzados.flatMap(p => p.empresas))).sort();\n  const listaTipos = Array.from(new Set(projetosCruzados.flatMap(p => p.tipos))).sort();",
  "  // Opcoes dos filtros acompanham a situacao escolhida da carteira.\n  const projetosDisponiveisPorStatus = filterStatusProjeto === 'TODOS'\n    ? projetosCruzados\n    : projetosCruzados.filter((p) => p.statusProjeto === filterStatusProjeto);\n  const listaProjetos = Array.from(new Set(projetosDisponiveisPorStatus.map((p) => p.nome).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));\n  const listaEmpresas = Array.from(new Set(projetosDisponiveisPorStatus.flatMap(p => p.empresas))).sort();\n  const listaTipos = Array.from(new Set(projetosDisponiveisPorStatus.flatMap(p => p.tipos))).sort();",
  'listas de filtros por status'
);

replaceOnce(
  "  const hasProjectScopeFilter = filterProjetos.length > 0\n    || filterEmpresas.length > 0\n    || filterTipos.length > 0",
  "  const hasProjectScopeFilter = filterStatusProjeto !== 'TODOS'\n    || filterProjetos.length > 0\n    || filterEmpresas.length > 0\n    || filterTipos.length > 0",
  'escopo financeiro por status'
);

replaceOnce(
  "  const usarCarteiraCompleta = filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;",
  "  const usarCarteiraCompleta = filterStatusProjeto === 'TODOS' && filterProjetos.length === 0 && filterEmpresas.length === 0 && filterTipos.length === 0;",
  'carteira completa por status'
);

replaceOnce(
  "  const hasGlobalProjectScopeFilter = filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0;",
  "  const hasGlobalProjectScopeFilter = filterStatusProjeto !== 'TODOS' || filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0;",
  'escopo global de impostos por status'
);

replaceOnce(
  "      .filter((p) => {\n        if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;",
  "      .filter((p) => {\n        if (filterStatusProjeto !== 'TODOS' && p.statusProjeto !== filterStatusProjeto) return false;\n        if (filterProjetos.length > 0 && !filterProjetos.includes(p.nome)) return false;",
  'status no conjunto de impostos'
);

replaceOnce(
  '  ), [projetosCruzados, filterProjetos, filterEmpresas, filterTipos]);',
  '  ), [projetosCruzados, filterStatusProjeto, filterProjetos, filterEmpresas, filterTipos]);',
  'dependencias do conjunto de impostos'
);

replaceOnce(
  '    Tipos: filterTipos.length ? filterTipos : "Todos",\n    "Rateio administrativo": incluirRateioAdm ? "Incluído" : "Não incluído",',
  '    Tipos: filterTipos.length ? filterTipos : "Todos",\n    "Status do projeto": filterStatusProjeto === "TODOS" ? "Todos" : (filterStatusProjeto === "CONCLUIDO" ? "Concluídos (100% faturados)" : "Em andamento"),\n    "Rateio administrativo": incluirRateioAdm ? "Incluído" : "Não incluído",',
  'status nos filtros do relatorio'
);

replaceOnce(
  '  const clearAllFilters = () => {\n    setFilterProjetos([]); setFilterEmpresas([]); setFilterTipos([]);',
  "  const clearAllFilters = () => {\n    setFilterProjetos([]); setFilterEmpresas([]); setFilterTipos([]); setFilterStatusProjeto('TODOS');",
  'limpeza do filtro de status'
);

const typeFilterBlock = [
  "          <div style={{ flex: '1 1 140px', minWidth: 0 }}>",
  "            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>",
  "              <LayoutDashboard size={12} /> Tipo",
  "            </label>",
  "            <MultiSelect options={listaTipos} value={filterTipos} onChange={(v) => { setFilterTipos(v); setTablePage(1); }} placeholder=\"Todos os tipos\" />",
  "          </div>"
].join('\n');

const typeAndStatusBlock = [
  typeFilterBlock,
  "",
  "          <div style={{ flex: '1 1 170px', minWidth: 0 }}>",
  "            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>",
  "              <Target size={12} /> Situação do Projeto",
  "            </label>",
  "            <select",
  "              value={filterStatusProjeto}",
  "              onChange={(e) => { setFilterStatusProjeto(e.target.value); setFilterProjetos([]); setTablePage(1); }}",
  "              style={{ width: '100%', height: '34px', fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.5rem' }}",
  "              aria-label=\"Situação do Projeto\"",
  "            >",
  "              <option value=\"TODOS\">Todos</option>",
  "              <option value=\"EM_ANDAMENTO\">Em andamento</option>",
  "              <option value=\"CONCLUIDO\">Concluídos (100% faturados)</option>",
  "            </select>",
  "          </div>"
].join('\n');

replaceOnce(typeFilterBlock, typeAndStatusBlock, 'controle visual do status');

replaceOnce(
  '        {(filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0) && (',
  "        {(filterStatusProjeto !== 'TODOS' || filterProjetos.length > 0 || filterEmpresas.length > 0 || filterTipos.length > 0) && (",
  'badge de filtros ativos'
);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Filtro Todos / Em andamento / Concluidos aplicado com conclusao por 100% faturado.');
