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
      const candidates = (byDocument.get(contract.cpDocument) || []).filter((row) =>
        dateKey(row.data) === dateKey(installment.dueDate)
        && cents(row.valor) === cents(installment.total)
      );
      const realized = candidates.filter((row) => {
        const status = String(row.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        return !status.startsWith('A ') && /REALIZADO|PAGO|EFETIVADO/.test(status);
      });
      const match = candidates.length === 1 ? candidates[0] : null;
      const status = !snapshot ? 'SEM_BASE_CP'
        : candidates.length > 1 ? 'CONFERIR'
          : realized.length === 1 && match === realized[0] ? 'PAGO'
            : candidates.length === 0 ? 'SEM_VINCULO'
              : dateKey(installment.dueDate) < new Date().toISOString().slice(0, 10) ? 'VENCIDO' : 'A_VENCER';
      return { ...installment, reconciliation: status, cpMatch: match ? {
        date: match.data, amount: Number(match.valor), status: match.status,
      } : null };
    }),
  }));
}

export function loanPayload(body) {
  const cpDocument = String(body.cpDocument || '').trim();
  const bank = String(body.bank || '').trim();
  const count = Number(body.installmentCount);
  const amount = Number(body.amount);
  if (!cpDocument || cpDocument.length > 100 || !bank || bank.length > 120) throw new Error('Informe o documento CP e o banco.');
  if (!Number.isInteger(count) || count < 1 || count > 600) throw new Error('Quantidade de parcelas inválida.');
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
  const status = ['ATIVO', 'QUITADO', 'RENEGOCIADO', 'SUSPENSO'].includes(body.status) ? body.status : 'ATIVO';
  if (body.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || Number.isNaN(new Date(`${body.startDate}T12:00:00Z`).getTime()) || dateKey(new Date(`${body.startDate}T12:00:00Z`)) !== body.startDate)) {
    throw new Error('Data inicial inválida.');
  }
  return {
    cpDocument, bank, contractNumber: String(body.contractNumber || '').trim().slice(0, 100) || null,
    modality: String(body.modality || '').trim().slice(0, 100) || null,
    amount, installmentCount: count, status,
    startDate: body.startDate ? new Date(`${body.startDate}T12:00:00Z`) : null,
    installments,
  };
}
