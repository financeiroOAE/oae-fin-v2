import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDueDateKey, isInvoiceWithinDueRange } from '../src/lib/invoiceDateRange.mjs';

test('normaliza data brasileira para chave ISO', () => {
  assert.equal(invoiceDueDateKey('12/10/2026'), '2026-10-12');
  assert.equal(invoiceDueDateKey('2026-10-12'), '2026-10-12');
  assert.equal(invoiceDueDateKey('31/02/2026'), '');
});
test('intervalo de vencimento inclui os dois limites', () => {
  assert.equal(isInvoiceWithinDueRange('01/10/2026','2026-10-01','2026-10-31'),true);
  assert.equal(isInvoiceWithinDueRange('31/10/2026','2026-10-01','2026-10-31'),true);
  assert.equal(isInvoiceWithinDueRange('01/11/2026','2026-10-01','2026-10-31'),false);
});
test('filtro permite limites independentes ou nenhuma restrição', () => {
  assert.equal(isInvoiceWithinDueRange('11/10/2026','2026-10-12',''),false);
  assert.equal(isInvoiceWithinDueRange('13/10/2026','2026-10-12',''),true);
  assert.equal(isInvoiceWithinDueRange('13/10/2026','','2026-10-12'),false);
  assert.equal(isInvoiceWithinDueRange('13/10/2026','',''),true);
  assert.equal(isInvoiceWithinDueRange('inválida','2026-10-01',''),false);
});
