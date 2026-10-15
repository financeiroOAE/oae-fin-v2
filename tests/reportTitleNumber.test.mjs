import test from 'node:test';
import assert from 'node:assert/strict';
import { getReportTitleNumber, REPORT_TITLE_NUMBER_KEY } from '../src/lib/reportTitleNumber.mjs';

test('CP_GERAL usa Título e não Documento', () => {
  assert.equal(getReportTitleNumber({ titulo: '000123', documento: 'NF 780' }), '000123');
  assert.equal(getReportTitleNumber({ 'Título': 5231 }), '5231');
});
test('CR_GERAL usa Lançamento', () => {
  assert.equal(getReportTitleNumber({ lancamento: '98765', documento: 'NFES-10' }), '98765');
  assert.equal(getReportTitleNumber({ Lançamento: '000987' }), '000987');
});
test('não confunde contagem, documento ou valores ausentes com título', () => {
  assert.equal(getReportTitleNumber({ Documento: 'NF 123', Lançamentos: 25 }), '');
  assert.equal(getReportTitleNumber({ [REPORT_TITLE_NUMBER_KEY]: '', Lançamento: 456 }), '456');
  assert.equal(getReportTitleNumber({ [REPORT_TITLE_NUMBER_KEY]: '0009', Lançamento: 456 }), '0009');
  assert.equal(getReportTitleNumber({ titulo: '-', lancamento: '' }), '');
});
