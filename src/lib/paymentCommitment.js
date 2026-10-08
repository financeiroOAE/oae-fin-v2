// Destaca apenas obrigacoes documentadas a pagar no mes corrente.
// Uma previsao (PRV/PCT) nunca vira compromisso por conter termos em sua descricao.
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ').trim().toUpperCase();
}

export function financialMonthKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 20000 && serial <= 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
        .toISOString().slice(0, 7);
    }
  }
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (match) return validatedMonth(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);
  return match ? validatedMonth(Number(match[3]), Number(match[2]), Number(match[1])) : '';
}

function validatedMonth(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return '';
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day) return '';
  return year + '-' + String(month).padStart(2, '0');
}

export function isDocumentedPayableCurrentMonth(row, today = new Date()) {
  if (!row || typeof row !== 'object' || !(today instanceof Date) || Number.isNaN(today.getTime())) return false;

  const nature = normalize(row.natureza);
  const status = normalize(row.statusExibicao ?? row['Situação'] ?? row.Situacao ?? row.status ?? '');
  if (nature === 'ENTRADA' || /\b(A RECEBER|RECEBIDO|PAGO|REALIZADO|EFETIVADO)\b/.test(status) || row.paid === true) return false;
  const isOpen = row.paid === false || /\b(A PAGAR|A REALIZAR|PREVISTO|PENDENTE)\b/.test(status);
  if (!isOpen) return false;

  const document = normalize(row.documento ?? row.Documento ?? '').replace(/^[#\s]+/, '');
  if (!document || /^(PRV|PCT|PREV(?:ISAO)?)(?:$|[.\s:/_-]|\d)/.test(document)) return false;
  const formalDocument = /^(?:NFES|NFSE|NFS-E|NFE|NF-E|NFS|NF|NOTA FISCAL|O\.?S\.?|ORDEM DE SERVICO|FATURA|FATURAMENTO|FAT|BOLETO|DUPLICATA)(?:$|[.\s:/_-]|\d)/.test(document);
  if (!formalDocument) return false;

  const date = row.data ?? row.Data ?? row.vencimento ?? row.Vencimento;
  const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  return financialMonthKey(date) === currentMonth;
}

export function paymentStatusForReport(row) {
  const status = row?.['Situação'] ?? row?.Situacao ?? row?.statusExibicao ?? row?.status ?? '';
  return isDocumentedPayableCurrentMonth(row) ? 'A pagar · compromisso do mês' : status;
}
