"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  ArrowDownRight, ArrowUpRight, ArrowDownAZ, ArrowUpAZ, ArrowUpDown,
  Search, FilterX
} from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import { isDocumentedPayableNext30Days } from '@/lib/paymentCommitment';

export default function DataTable({ data, initialPageSize = 25, pageSizeOptions = [25, 50, 100] }) {
  // Configuração
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'dataTimestamp', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros Avançados
  const [filterDataInicial, setFilterDataInicial] = useState('');
  const [filterDataFinal, setFilterDataFinal] = useState('');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterProjeto, setFilterProjeto] = useState([]);
  const [filterNome, setFilterNome] = useState([]);
  const [filterConta, setFilterConta] = useState([]);

  // Debounce do Search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Tratamento dos dados originais para incluir timestamp e status formatado
  const processedData = useMemo(() => {
    return data.map(item => {
      let timestamp = 0;
      if (item.data) {
        const parts = item.data.split('/');
        if (parts.length === 3) {
          timestamp = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
      }

      let statusAmigavel = item.status;
      if (item.natureza === 'Entrada') {
        if (item.status === 'Realizado') statusAmigavel = 'Recebido';
        if (item.status === 'A realizar') statusAmigavel = 'A receber';
      } else if (item.natureza === 'Saída') {
        if (item.status === 'Realizado') statusAmigavel = 'Pago';
        if (item.status === 'A realizar') statusAmigavel = 'A pagar';
      }

      return {
        ...item,
        dataTimestamp: timestamp,
        statusExibicao: statusAmigavel
      };
    });
  }, [data]);

  // Listas Únicas para os Selects
  const projetosDisponiveis = useMemo(() => Array.from(new Set(processedData.map(d => d.projeto).filter(Boolean))).sort(), [processedData]);
  const nomesDisponiveis = useMemo(() => Array.from(new Set(processedData.map(d => d.nome).filter(Boolean))).sort(), [processedData]);
  const contasDisponiveis = useMemo(() => Array.from(new Set(processedData.map(d => d.contaDescricao).filter(Boolean))).sort(), [processedData]);

  // Aplicação de Filtros
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      // 1. Busca textual geral
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        const textContent = `${item.documento || ''} ${item.contaCodigo || ''}`.toLowerCase();
        // Não incluir os selects na busca livre para não confundir o usuário que já filtrou via dropdown
        if (!textContent.includes(term) && !String(item.nome || '').toLowerCase().includes(term)) return false;
      }

      // 2. Selects
      if (filterProjeto.length > 0 && !filterProjeto.includes(item.projeto)) return false;
      if (filterNome.length > 0 && !filterNome.includes(item.nome)) return false;
      if (filterConta.length > 0 && !filterConta.includes(item.contaDescricao)) return false;

      // 3. Data
      if (filterDataInicial) {
        const dIni = new Date(filterDataInicial + 'T00:00:00').getTime();
        if (item.dataTimestamp < dIni) return false;
      }
      if (filterDataFinal) {
        const dFim = new Date(filterDataFinal + 'T23:59:59').getTime();
        if (item.dataTimestamp > dFim) return false;
      }

      // 4. Status
      if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;

      return true;
    });
  }, [processedData, debouncedSearch, filterDataInicial, filterDataFinal, filterStatus, filterProjeto, filterNome, filterConta]);

  // Ordenação
  const sortedData = useMemo(() => {
    const sortable = [...filteredData];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredData, sortConfig]);

  // Paginação
  const totalItems = sortedData.length;
  const showAllRows = pageSize === 'all';
  const effectivePageSize = showAllRows ? Math.max(totalItems, 1) : Number(pageSize) || 25;
  const totalPages = showAllRows ? 1 : (Math.ceil(totalItems / effectivePageSize) || 1);
  const paginatedData = showAllRows
    ? sortedData
    : sortedData.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  // Totais
  const totalValorFiltrado = useMemo(() => {
    return filteredData.reduce((acc, row) => acc + (row.natureza === 'Entrada' ? row.valor : -row.valor), 0);
  }, [filteredData]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />;
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setFilterDataInicial('');
    setFilterDataFinal('');
    setFilterStatus([]);
    setFilterProjeto([]);
    setFilterNome([]);
    setFilterConta([]);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar: Busca e Totais */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar (Nome, Conta, Obra, Docto...)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.2rem', height: '34px', fontSize: '13px' }}
            />
          </div>
          
          <button onClick={limparFiltros} className="btn" style={{ height: '34px', background: 'transparent', border: '1px solid var(--border-color)', display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '12px' }}>
            <FilterX size={14} /> Limpar Filtros
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Saldo Filtrado</p>
            <p style={{ fontSize: '16px', fontWeight: '600', color: totalValorFiltrado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(totalValorFiltrado)}
            </p>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Registros</p>
            <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>
              {filteredData.length} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400' }}>de {data.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Data Inicial</label>
          <input type="date" value={filterDataInicial} onChange={(e) => setFilterDataInicial(e.target.value)} style={{ width: '100%', height: '32px', fontSize: '13px' }} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Data Final</label>
          <input type="date" value={filterDataFinal} onChange={(e) => setFilterDataFinal(e.target.value)} style={{ width: '100%', height: '32px', fontSize: '13px' }} />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Projeto / Obra</label>
          <MultiSelect options={projetosDisponiveis} selected={filterProjeto} onChange={setFilterProjeto} placeholder="Todos os projetos" />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nome</label>
          <MultiSelect options={nomesDisponiveis} selected={filterNome} onChange={setFilterNome} placeholder="Todos os nomes" />
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Conta</label>
          <MultiSelect options={contasDisponiveis} selected={filterConta} onChange={setFilterConta} placeholder="Todas as contas" />
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Situação</label>
          <MultiSelect options={['Pago','A pagar','Recebido','A receber']} selected={filterStatus} onChange={setFilterStatus} placeholder="Todas as situações" />
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
        <table style={{ width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
            <tr style={{ fontSize: '12px' }}>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('dataTimestamp')}>
                Data <SortIcon columnKey="dataTimestamp" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('nome')}>
                Descrição/Nome <SortIcon columnKey="nome" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('contaDescricao')}>
                Conta <SortIcon columnKey="contaDescricao" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('projeto')}>
                Projeto/CC <SortIcon columnKey="projeto" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('documento')}>
                Documento <SortIcon columnKey="documento" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('statusExibicao')}>
                Status <SortIcon columnKey="statusExibicao" />
              </th>
              <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('valor')}>
                Valor <SortIcon columnKey="valor" />
              </th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '13px' }}>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={idx} style={{ transition: 'background 0.2s ease', ...(isDocumentedPayableNext30Days(row) ? { background: 'rgba(56, 189, 248, 0.10)', boxShadow: 'inset 3px 0 0 #38bdf8' } : {}) }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.data}</td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.nome}>{row.nome}</td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${row.contaCodigo} - ${row.contaDescricao}`}>
                    <span className="badge" style={{background: 'rgba(255,255,255,0.05)', marginRight: '0.4rem', fontSize: '10px'}}>{row.contaCodigo}</span>
                    {row.contaDescricao}
                  </td>
                  <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.projeto}>{row.projeto}</td>
                  <td style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.documento}>{row.documento}</td>
                  <td>
                    <span className={`badge ${['Pago', 'Recebido'].includes(row.statusExibicao) ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '11px', padding: '0.2rem 0.4rem' }}>
                      {row.statusExibicao}
                    </span>
                    {isDocumentedPayableNext30Days(row) && <span title="Documento formal a pagar com vencimento nos próximos 30 dias" style={{ display:'inline-block', marginLeft:6, fontSize:10, fontWeight:700, color:'#38bdf8', whiteSpace:'nowrap' }}>Vence em até 30 dias</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500', color: row.natureza === 'Entrada' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                    {row.natureza === 'Entrada' ? '+' : '-'}{formatCurrency(row.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>
            {totalItems === 0
              ? 'Exibindo 0 de 0'
              : `Exibindo ${showAllRows ? 1 : (currentPage - 1) * effectivePageSize + 1} a ${showAllRows ? totalItems : Math.min(currentPage * effectivePageSize, totalItems)} de ${totalItems}`}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              const next = e.target.value === 'all' ? 'all' : Number(e.target.value);
              setPageSize(next);
              setCurrentPage(1);
            }}
            style={{ height: '28px', padding: '0 0.5rem', fontSize: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size === 'all' ? 'Todos' : `${size} por pág.`}
              </option>
            ))}
          </select>
        </div>

        {!showAllRows && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn" style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronsLeft size={16} /></button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn" style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '13px', color: 'var(--text-main)' }}>
              Pág. {currentPage} de {totalPages}
            </span>

            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn" style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', opacity: currentPage === totalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="btn" style={{ padding: '0.3rem', background: 'transparent', border: '1px solid var(--border-color)', opacity: currentPage === totalPages ? 0.3 : 1 }}><ChevronsRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
