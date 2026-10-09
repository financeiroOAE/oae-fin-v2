import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFinancialAccounts } from '../src/lib/financialAccounts.js';
import { auditFinancialNomenclatures } from '../src/lib/financialNomenclatureAudit.js';

const row = (code, name, valor, status='Realizado', natureza='Saída') => ({
  contaCodigo:code, contaNome:name, valor, status, natureza,
  data:'09/10/2026', projeto:'ADMINISTRAÇÃO'
});

test('o mesmo codigo agrega nomenclaturas divergentes sem perder centavos', () => {
  const rows=[
    row('2010522','DESP ADM RETIRADAS SÓCIOS', 100.01),
    row('2010522','RETIRADAS SOCIOS', 192.94),
    row('2010522','RETIRADAS SOCIOS', 10,'A realizar'),
    row('2010523','RETIRADAS SOCIOS', 5)
  ];
  const groups=groupFinancialAccounts(rows);
  assert.equal(groups.length, 2);
  const withdrawal=groups.find(item=>item.code==='2010522');
  assert.deepEqual({paid:withdrawal.paid,open:withdrawal.open,total:withdrawal.total},
    {paid:292.95,open:10,total:302.95});
  assert.equal(withdrawal.aliases.length,2);
});

test('o realizado da Visão Financeira é o mesmo subconjunto realizado do Fluxo', () => {
  const rows=[
    row('2010522','Retiradas', 120),
    row('2010522','Retiradas', 30,'A realizar'),
    row('2010302','Equipe', 20,'Efetivado'),
    row('2010302','Equipe', 50,'Previsto'),
  ];
  const result=auditFinancialNomenclatures({sourceRows:rows,cpRows:rows,year:'2026'});
  assert.equal(result.scopes.visaoFinanceiraRealizado.total,140);
  assert.equal(result.scopes.fluxoCaixaRealizado.total,140);
  assert.equal(result.scopes.fluxoCaixaPrevisto.total,80);
  assert.equal(result.scopes.contasPagar.total,220);
  assert.equal(result.findings.sourceVersusNormalized.length,0);
});

test('a auditoria aponta códigos com varias nomenclaturas sem declarar falsa divergência de saldo', () => {
  const rows=[
    row('2010522','Retiradas Sócios',100.01),
    row('2010522','DESP ADM RETIRADAS SÓCIOS',92.93),
    row('2010302','Equipe ADM',100)
  ];
  const result=auditFinancialNomenclatures({sourceRows:rows,cpRows:rows,year:'2026'});
  assert.equal(result.findings.sourceVersusNormalized.length,0);
  assert.equal(result.findings.nomenclatureVariations.length,1);
  assert.equal(result.scopes.administrativo.total,292.94);
});
