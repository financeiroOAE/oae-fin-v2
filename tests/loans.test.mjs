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
  assert.equal(reconcile(rows, [installment(1, '2026-04-20')])[0].reconciliation, 'PAGO_DIVERGENTE');
  rows[1].titulo = '9999/1';
  assert.equal(reconcile(rows, [installment(1, '2026-04-20')])[0].reconciliation, 'CONFERIR');
  assert.equal(reconcile(rows, [installment(3, '2026-04-20')])[0].reconciliation, 'CONFERIR');
});

test('identifica pagamento realizado com valor divergente sem mascarar a diferença', () => {
  const rows = [cp('TITULO/4', '20/07/2026', 1050.98), cp('TITULO/4', '20/07/2026', 149.65)];
  const [result] = reconcile(rows, [installment(4, '2026-07-20', 1200.55)]);
  assert.equal(result.reconciliation, 'PAGO_DIVERGENTE');
  assert.equal(result.cpMatch.amount, 1200.63);
  assert.equal(result.cpMatch.realized, true);
});

test('preserva conciliação de parcela única e requer documento e data exatos', () => {
  const rows = [cp('', '19/10/2026', 1200.63, 'A realizar')];
  assert.equal(reconcile(rows, [installment(7, '2026-10-19')])[0].reconciliation, 'A_VENCER');
  assert.equal(reconcile(rows, [installment(7, '2026-10-20')])[0].reconciliation, 'SEM_VINCULO');
  rows[0].documento = 'OUTRO';
  assert.equal(reconcile(rows, [installment(7, '2026-10-19')])[0].reconciliation, 'SEM_VINCULO');
});

test('reconcilia pagamentos de 2026 quando o título reinicia a numeração das parcelas', () => {
  const rows = [
    cp('NOVO/1', '02/01/2026', 1200.63, 'Realizado', ' EMP.TESTE '),
    cp('NOVO/2', '02/02/2026', 1000.10, 'Realizado', 'EMP.TESTE'),
    cp('NOVO/2', '02/02/2026', 200.53, 'Realizado', 'EMP.TESTE'),
    cp('NOVO/3', '02/03/2026', 1217.18, 'Realizado', 'EMP.TESTE'),
  ];
  const results = reconcile(rows, [
    installment(6, '2026-01-02'),
    installment(7, '2026-02-02'),
    installment(8, '2026-03-02'),
    installment(5, '2025-12-01'),
  ]);
  assert.deepEqual(results.map((row) => row.reconciliation), ['PAGO', 'PAGO', 'PAGO_DIVERGENTE', 'HISTORICO_ANTERIOR']);
  assert.equal(results[1].cpMatch.rowCount, 2);
  assert.equal(results[2].cpMatch.amount, 1217.18);
});

test('não baixa parcela por data quando houver títulos diferentes no mesmo documento', () => {
  const rows = [cp('A/1', '02/01/2026', 600), cp('B/1', '02/01/2026', 600.63)];
  assert.equal(reconcile(rows, [installment(6, '2026-01-02')])[0].reconciliation, 'CONFERIR');
});
