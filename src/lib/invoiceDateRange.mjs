/**
 * Compara vencimentos das NFES por dia civil, independentemente do fuso horário.
 * Aceita datas brasileiras da base (DD/MM/AAAA) e ISO (AAAA-MM-DD).
 * Preserva a relação de notas: este utilitário apenas filtra, sem recalcular valores.
 */
export function invoiceDueDateKey(value) {
  const raw = String(value ?? "").trim();
  let year, month, day;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (br) [day, month, year] = br.slice(1).map(Number);
  else if (iso) [year, month, day] = iso.slice(1).map(Number);
  else return "";
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return "";
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return "";
  return [year, month, day].map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join("-");
}

export function isInvoiceWithinDueRange(dueDate, initialDate = "", finalDate = "") {
  if (!initialDate && !finalDate) return true;
  const key = invoiceDueDateKey(dueDate);
  if (!key) return false;
  if (initialDate && key < initialDate) return false;
  if (finalDate && key > finalDate) return false;
  return true;
}
