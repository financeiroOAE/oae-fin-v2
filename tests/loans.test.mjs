import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileLoans } from '../src/lib/loans.js';

function installment(number, date, total = 1200.63) {
  return { number, dueDate: new Date(`${date}T12:00:00Z`), total, principal: 1000.10, interest: 200.53, other: 0 };
}

function cp(title, date, amount, status = 'Realizado', document = 'EMP.TESTE') {
  return { natureza: 'Saída', documento: document, titulo: title, data: date, valor: amount, status };
}

function reconcile(rows, installments) {
  return reconcileLoans([{ cpDocument: 'EMP.TESTE', installments }], { payload: { data: rows } })[0].installments;
}

test('soma capital e juros do mesmo título/parcela e marca como pago somente se ambas as linhas foram realizadas', () => {
  const rows = [cp('TITULO/1', '20/04/2026', 1000.10), cp('TITULO/1', '20/04/2026', 200.53)];
  const [result] = reconcile(rows, [installment(1, '2026-04-20')]);
  assert.equal(result.reconciliation, 'PAGO');
  assert.deepEqual({ amount: result.cpMatch.amount, rowCount: result.cpMatch.rowCount, title: result.cpMatch.title },
    { amount: 1200.63, rowCount: 2, title: 'TITULO/1' });

  rows[1].status = 'A realizar';
  assert.equal(reconcile(rows, [installment(1, '2026-04-20')])[0].reconciliation, 'VENCIDO');
});

test('não mistura outras parcelas ou títulos e sinaliza ambiguidade', () => {
  const rows = [cp('TITULO/1', '20/04/2026', 1000.10), cp('TITULO/2', '20/04/2026', 200.53)];
  assert.equal(reconcile(rows, [installment(1, '2026-04-20')])[0].reconciliation, 'VALOR_DIVERGENTE');
  rows[1].titulo = '9999/1';
  assert.equal(reconcile(rows, [installment(1, '2026-04-20')])[0].reconciliation, 'CONFERIR');
  assert.equal(reconcile(rows, [installment(3, '2026-04-20')])[0].reconciliation, 'SEM_VINCULO');
});

test('mantém diferença de oito centavos da parcela 4 para conferência, sem baixa automática', () => {
  const rows = [cp('TITULO/4', '20/07/2026', 1050.98), cp('TITULO/4', '20/07/2026', 149.65)];
  const [result] = reconcile(rows, [installment(4, '2026-07-20', 1200.55)]);
  assert.equal(result.reconciliation, 'VALOR_DIVERGENTE');
  assert.equal(result.cpMatch.amount, 1200.63);
});

test('preserva conciliação de parcela única e requer documento e data exatos', () => {
  const rows = [cp('', '19/10/2026', 1200.63, 'A realizar')];
  assert.equal(reconcile(rows, [installment(7, '2026-10-19')])[0].reconciliation, 'A_VENCER');
  assert.equal(reconcile(rows, [installment(7, '2026-10-20')])[0].reconciliation, 'SEM_VINCULO');
  rows[0].documento = 'OUTRO';
  assert.equal(reconcile(rows, [installment(7, '2026-10-19')])[0].reconciliation, 'SEM_VINCULO');
});
