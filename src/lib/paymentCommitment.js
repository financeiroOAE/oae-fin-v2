// Alerta visual para títulos formais ainda abertos, com vencimento nos próximos 30 dias.
// Não interfere nos valores, rateios, no status original nem nas previsões PRV/PCT.
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function validatedDay(year, month, day) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

export function financialDateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return validatedDay(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // O relatório original do Sienge pode vir com datas serializadas pelo Excel.
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 20000 && serial <= 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return validatedDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (match) return validatedDay(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);
  return match ? validatedDay(Number(match[3]), Number(match[2]), Number(match[1])) : '';
}

export function financialMonthKey(value) {
  return financialDateKey(value).slice(0, 7);
}

export function isDocumentedPayableNext30Days(row, today = new Date()) {
  if (!row || typeof row !== 'object' || !(today instanceof Date) || Number.isNaN(today.getTime())) return false;

  const nature = normalize(row.natureza);
  const status = normalize(row.statusExibicao ?? row['Situação'] ?? row.Situacao ?? row.status ?? '');
  if (nature === 'ENTRADA' || /\b(A RECEBER|RECEBIDO|PAGO|REALIZADO|EFETIVADO)\b/.test(status) || row.paid === true) return false;
  const isOpen = row.paid === false || /\b(A PAGAR|A REALIZAR|PREVISTO|PENDENTE)\b/.test(status);
  if (!isOpen) return false;

  // Não tratar previsão sem nota/OS como dívida documental já formalizada.
  const document = normalize(row.documento ?? row.Documento ?? '').replace(/^[#\s]+/, '');
  if (!document || /^(PRV|PCT|PREV(?:ISAO)?)(?:$|[.\s:/_-]|\d)/.test(document)) return false;
  if (!/^(?:NFES|NFSE|NFS-E|NFE|NF-E|NFS|NF|NOTA FISCAL|O\.?S\.?|ORDEM DE SERVICO|FATURA|FATURAMENTO|FAT|BOLETO|DUPLICATA)(?:$|[.\s:/_-]|\d)/.test(document)) return false;

  const due = financialDateKey(row.vencimento ?? row.Vencimento ?? row.data ?? row.Data);
  if (!due) return false;
  const todayKey = validatedDay(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (!todayKey) return false;
  const days = (Date.parse(due + 'T00:00:00Z') - Date.parse(todayKey + 'T00:00:00Z')) / 86400000;
  return days >= 0 && days <= 30;
}

export function paymentStatusForReport(row) {
  const status = row?.['Situação'] ?? row?.Situacao ?? row?.statusExibicao ?? row?.status ?? '';
  return isDocumentedPayableNext30Days(row) ? 'A pagar · vence em até 30 dias' : status;
}
