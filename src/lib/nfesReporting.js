const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const parseDateTimestamp = (value) => {
  if (!value) return 0;
  const raw = String(value).trim();
  let match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  return 0;
};

const isGenericProject = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (normalized.includes('ADMINISTRA')) return true;
  return [
    'GRUPO OAE',
    'SEM PROJETO',
    'PROJETOS',
    'PROJETO',
    'PROJETOS GERAL',
    'PROJETOS GERAIS',
  ].includes(normalized);
};

const isReceivedStatus = (value) => {
  const status = normalizeText(value);
  return status.includes('REALIZADO')
    || status.includes('RECEBIDO')
    || status.includes('EFETIVADO');
};

const isReceivableStatus = (value) => {
  const status = normalizeText(value);
  return status.includes('A RECEBER')
    || status.includes('A REALIZAR')
    || status.includes('PREVISTO');
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function buildNfesSummary(rows = []) {
  const notes = new Map();
  const seenRows = new Set();

  (rows || []).forEach((row, index) => {
    if (String(row?.natureza || '').toUpperCase() !== 'ENTRADA') return;

    const documento = String(row?.documento || '').trim();
    if (!normalizeText(documento).includes('NFES')) return;

    const received = isReceivedStatus(row?.status || row?.statusExibicao);
    const receivable = !received && isReceivableStatus(row?.status || row?.statusExibicao);
    if (!received && !receivable) return;

    const liquidValue = Math.abs(Number(row?.valorCaixa ?? row?.valor) || 0);
    const grossReference = Math.abs(Number(
      row?.valorFaturamentoOriginal
      ?? row?.valorFaturamento
      ?? row?.valorTotalTitulo
      ?? row?.valorBruto
    ) || 0);

    const rowKey = [
      normalizeText(documento),
      String(row?.lancamento || '').trim(),
      normalizeText(row?.status),
      String(row?.data || '').trim(),
      String(row?.contaCodigo || '').trim(),
      normalizeText(row?.projeto),
      liquidValue.toFixed(2),
    ].join('|');

    if (seenRows.has(rowKey)) return;
    seenRows.add(rowKey);

    const key = normalizeText(documento) || `NFES-ROW-${index}`;
    const current = notes.get(key) || {
      key,
      documento: documento || '-',
      nome: String(row?.nome || '').trim(),
      projects: new Set(),
      lancamentos: new Set(),
      valorNota: 0,
      valorRecebido: 0,
      saldoAReceber: 0,
      valorBrutoReferencia: 0,
      vencimento: '',
      dataTimestamp: 0,
      recebimentoMaisRecente: '',
      recebimentoTimestamp: 0,
    };

    current.valorNota += liquidValue;
    if (received) current.valorRecebido += liquidValue;
    if (receivable) current.saldoAReceber += liquidValue;
    current.valorBrutoReferencia = Math.max(current.valorBrutoReferencia, grossReference);

    const project = String(row?.projeto || '').trim();
    if (project && !isGenericProject(project)) current.projects.add(project);

    const lancamento = String(row?.lancamento || '').trim();
    if (lancamento) current.lancamentos.add(lancamento);

    const candidateDate = row?.dataVencimento || row?.vencimento || row?.data || '';
    const candidateTs = parseDateTimestamp(candidateDate);

    if (receivable && candidateTs && (!current.dataTimestamp || candidateTs < current.dataTimestamp)) {
      current.vencimento = candidateDate;
      current.dataTimestamp = candidateTs;
    }

    if (received && candidateTs && candidateTs > current.recebimentoTimestamp) {
      current.recebimentoMaisRecente = candidateDate;
      current.recebimentoTimestamp = candidateTs;
    }

    if (!current.nome && row?.nome) current.nome = String(row.nome).trim();
    notes.set(key, current);
  });

  return [...notes.values()]
    .map((note) => {
      const projects = [...note.projects].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const lancamentos = [...note.lancamentos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const valorNota = roundMoney(note.valorNota);
      const valorRecebido = roundMoney(note.valorRecebido);
      const saldoAReceber = roundMoney(note.saldoAReceber);
      const status = valorRecebido > 0 && saldoAReceber > 0
        ? 'Parcial'
        : saldoAReceber > 0
          ? 'A receber'
          : 'Recebido';

      return {
        ...note,
        projects,
        lancamentos,
        projeto: projects.length ? projects.join(' / ') : 'Não identificado',
        lancamento: lancamentos.join(' / '),
        valorNota,
        valorLiquido: valorNota,
        valorRecebido,
        saldoAReceber,
        valorBruto: roundMoney(note.valorBrutoReferencia),
        status,
        vencimento: note.vencimento || note.recebimentoMaisRecente || '',
        dataTimestamp: note.dataTimestamp || note.recebimentoTimestamp || 0,
      };
    })
    .sort((a, b) => (b.dataTimestamp || 0) - (a.dataTimestamp || 0));
}

export function normalizeNfFilterText(value) {
  return normalizeText(value);
}

export function parseNfDateTimestamp(value) {
  return parseDateTimestamp(value);
}
