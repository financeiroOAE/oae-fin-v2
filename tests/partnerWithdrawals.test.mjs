import test from 'node:test';
import assert from 'node:assert/strict';
import { isPartnerWithdrawal } from '../src/lib/financialClassification.js';
import { partnerIdForRow, withdrawalAccountLabel, summarizeFinancialRows, reconcilePartnerWithdrawals } from '../src/lib/partnerWithdrawals.js';

test('o codigo 2010522 identifica retiradas mesmo se a descricao variar', () => {
  assert.equal(isPartnerWithdrawal({ contaCodigo: '2.01.05.22', contaNome: 'Distribuição' }), true);
  assert.equal(isPartnerWithdrawal({ contaCodigo: '2010302', contaNome: 'Equipe ADM' }), false);
  assert.equal(isPartnerWithdrawal({ contaNome: 'DESP ADM RETIRADAS SÓCIOS' }), true);
});

test('apelidos dos favorecidos são consistentes e nomes de terceiros não são sócios', () => {
  assert.equal(partnerIdForRow({nome:'FRANCIELLE PAIVA'}), 'francielle');
  assert.equal(partnerIdForRow({nome:'Paulo Henrique Lemes Araújo'}), 'paulo');
  assert.equal(partnerIdForRow({nome:'PHLA'}), 'paulo');
  assert.equal(partnerIdForRow({nome:'Fornecedora X'}), null);
});

test('a conta oficial agrega pago, aberto e lançamentos sem identificação do favorecido sem perder centavos', () => {
  const rows = [
    {contaCodigo:'2010522', contaNome:'DESP ADM RETIRADAS SÓCIOS', nome:'FRANCIELLE PAIVA', valor:765856.39, paid:true},
    {contaCodigo:'2010522', contaNome:'DESP ADM RETIRADAS SÓCIOS', nome:'Cadastro não identificado', valor:192.94, paid:true},
    {contaCodigo:'2010522', contaNome:'DESP ADM RETIRADAS SÓCIOS', nome:'PAULO HENRIQUE LEMES ARAÚJO', valor:6423, paid:false},
    {contaCodigo:'2010302', contaNome:'Equipe ADM', nome:'FRANCIELLE PAIVA', valor:3000, paid:true},
  ];
  const withdrawalRows = rows.filter(isPartnerWithdrawal);
  assert.equal(withdrawalAccountLabel(withdrawalRows[0]), 'DESP ADM RETIRADAS SÓCIOS');
  const result = reconcilePartnerWithdrawals(rows);
  assert.deepEqual(result.ledger, {paid:766049.33,open:6423,total:772472.33});
  assert.deepEqual(result.unassigned, {paid:192.94,open:0,total:192.94});
  assert.equal(result.reconciled, true);
  assert.deepEqual(summarizeFinancialRows(withdrawalRows), result.ledger);
});
