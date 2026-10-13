import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMovementRowsByReportPeriod } from '../src/lib/reportMovementOrder.mjs';

const rows = [
  { Data: '10/10/2026', Valor: 100 },
  { Data: '13/10/2026', Valor: 200 },
  { Data: '16/10/2026', Valor: 300 },
  { Data: '17/10/2026', Valor: 400 },
  { Data: 'sem data', Valor: 500 },
];

test('mostra somente lançamentos dentro das datas, incluindo início e fim', () => {
  const filtered = filterMovementRowsByReportPeriod(rows, { 'Data inicial': '2026-10-13', 'Data final': '2026-10-16' });
  assert.deepEqual(filtered.map(r => r.Valor), [200, 300]);
});
test('aplica limite único e preserva todos sem intervalo', () => {
  assert.deepEqual(filterMovementRowsByReportPeriod(rows, { 'Data inicial': '2026-10-16' }).map(r => r.Valor), [300,400]);
  assert.equal(filterMovementRowsByReportPeriod(rows, {}).length, rows.length);
});
