export function cents(value) {
  return Math.round(Number(value) * 100);
}

export function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function titleInstallment(value) {
  const match = String(value || '').trim().match(/^(.+?)\s*\/\s*0*(\d+)\s*$/);
  if (!match) return null;
  return { title: match[1].trim().replace(/\s+/g, ' ').toUpperCase(), number: Number(match[2]) };
}

function realizedPayment(row) {
  const status = String(row.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  return !status.startsWith('A ') && /REALIZADO|PAGO|EFETIVADO/.test(status);
}

function findInstallmentPayment(rows, installment) {
  const sameDate = rows.filter((row) => dateKey(row.data) === dateKey(installment.dueDate));
  const titled = sameDate.map((row) => ({ row, key: titleInstallment(row.titulo || row.lancamento) })).filter((entry) => entry.key);
  if (titled.length) {
    const matching = titled.filter((entry) => entry.key.number === installment.number);
    const groups = new Map();
    for (const entry of matching) groups.set(entry.key.title, [...(groups.get(entry.key.title) || []), entry.row]);
    if (groups.size > 1) return { ambiguous: true };
    if (groups.size === 1) {
      const [title, matchedRows] = [...groups][0];
      return { rows: matchedRows, title: `${title}/${installment.number}` };
    }
    return null;
  }
  const exact = sameDate.filter((row) => cents(row.valor) === cents(installment.total));
  if (exact.length > 1) return { ambiguous: true };
  return exact.length === 1 ? { rows: exact } : null;
}

export function reconcileLoans(contracts, snapshot) {
  const rows = (snapshot?.payload?.data || []).filter((row) => row.natureza === 'Saída');
  const byDocument = new Map();
  for (const row of rows) {
    const key = String(row.documento || '').trim();
    if (!key) continue;
    byDocument.set(key, [...(byDocument.get(key) || []), row]);
  }
  return contracts.map((contract) => ({
    ...contract,
    installments: contract.installments.map((installment) => {
      if (!contract.cpDocument) return { ...installment, reconciliation: 'SEM_DOCUMENTO', cpMatch: null };
      const payment = findInstallmentPayment(byDocument.get(contract.cpDocument) || [], installment);
      const match = payment?.rows;
      const amountCents = match?.reduce((sum, row) => sum + cents(row.valor), 0);
      const status = !snapshot ? 'SEM_BASE_CP'
        : payment?.ambiguous ? 'CONFERIR'
          : !match ? 'SEM_VINCULO'
            : amountCents !== cents(installment.total) ? 'VALOR_DIVERGENTE'
              : match.every(realizedPayment) ? 'PAGO'
                : dateKey(installment.dueDate) < new Date().toISOString().slice(0, 10) ? 'VENCIDO' : 'A_VENCER';
      return { ...installment, reconciliation: status, cpMatch: match ? {
        date: match[0].data, amount: amountCents / 100,
        status: [...new Set(match.map((row) => row.status))].join(' + '),
        title: payment.title || null, rowCount: match.length,
      } : null };
    }),
  }));
}

export function loanPayload(body) {
  const cpDocument = String(body.cpDocument || '').trim();
  const bank = String(body.bank || '').trim();
  const count = Number(body.installmentCount);
  const amount = Number(body.amount);
  if (cpDocument.length > 100 || !bank || bank.length > 120) throw new Error('Informe o banco (ou A confirmar).');
  if (!Number.isInteger(count) || count < 0 || count > 600) throw new Error('Quantidade de parcelas inválida.');
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(cents(amount) - amount * 100) > 0.00001) throw new Error('Valor contratado inválido.');
  const installments = (body.installments || []).map((item) => {
    const number = Number(item.number);
    const values = ['principal', 'interest', 'other'].map((key) => Number(item[key] || 0));
    const total = Number(item.total);
    if (!Number.isInteger(number) || number < 1 || number > count || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate || '') ||
      Number.isNaN(new Date(`${item.dueDate}T12:00:00Z`).getTime()) || dateKey(new Date(`${item.dueDate}T12:00:00Z`)) !== item.dueDate ||
      values.some((value) => !Number.isFinite(value) || value < 0 || Math.abs(cents(value) - value * 100) > 0.00001) ||
      !Number.isFinite(total) || total <= 0 || cents(total) !== values.reduce((sum, value) => sum + cents(value), 0)) {
      throw new Error(`Confira vencimento e composição da parcela ${number || ''}.`);
    }
    return {
      number, dueDate: new Date(`${item.dueDate}T12:00:00Z`),
      principal: values[0], interest: values[1], other: values[2], total,
    };
  });
  if (installments.length > count || new Set(installments.map((item) => item.number)).size !== installments.length) {
    throw new Error('Há parcelas repetidas ou acima da quantidade contratada.');
  }
  const status = ['ATIVO', 'A_CONFERIR', 'QUITADO', 'RENEGOCIADO', 'SUSPENSO'].includes(body.status) ? body.status : 'A_CONFERIR';
  if (body.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || Number.isNaN(new Date(`${body.startDate}T12:00:00Z`).getTime()) || dateKey(new Date(`${body.startDate}T12:00:00Z`)) !== body.startDate)) {
    throw new Error('Data inicial inválida.');
  }
  return {
    cpDocument: cpDocument || null, bank, contractNumber: String(body.contractNumber || '').trim().slice(0, 100) || null,
    sourceKey: String(body.sourceKey || '').trim().slice(0, 100) || null,
    holder: String(body.holder || '').trim().slice(0, 120) || null,
    kind: body.kind === 'CONSORCIO' ? 'CONSORCIO' : 'EMPRESTIMO',
    sourceNote: String(body.sourceNote || '').trim().slice(0, 2000) || null,
    reviewNotes: String(body.reviewNotes || '').trim().slice(0, 2000) || null,
    scheduleBasis: ['OFICIAL', 'PROJETADO', 'SEM_CRONOGRAMA'].includes(body.scheduleBasis) ? body.scheduleBasis : 'SEM_CRONOGRAMA',
    modality: String(body.modality || '').trim().slice(0, 100) || null,
    amount, installmentCount: count, status,
    startDate: body.startDate ? new Date(`${body.startDate}T12:00:00Z`) : null,
    installments,
  };
}
