import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterTeamMovementsByPerson,
  matchesTeamParty,
} from '../src/lib/teamMovementMatching.mjs';

test('inclui todos os projetos associados ao mesmo beneficiário, independentemente da obra', () => {
  const person = 'M V LOPES PROJETOS DE INFRAESTRUTURA E TOPOGRAFIA';
  const movements = [
    { sourceKey: '516', nome: person, projeto: '516-EBSERH-HU-MARIANA', paid: true },
    { sourceKey: '524', nome: person, projeto: '524-PBL-HSS-DF-INT', paid: false },
    { sourceKey: '539', nome: person, projeto: '539-AVIVA-RIO QUENTE', paid: false },
    { sourceKey: 'other', nome: 'OUTRA EMPRESA LTDA', projeto: '516-EBSERH-HU-MARIANA', paid: true },
  ];

  const result = filterTeamMovementsByPerson(person, movements);

  assert.deepEqual(result.map((row) => row.sourceKey), ['516', '524', '539']);
  assert.equal(new Set(result.map((row) => row.projeto)).size, 3);
});

test('mantém o filtro de período/status sem usar Departamento/Obra como filtro de associação', () => {
  const person = 'M V LOPES PROJETOS DE INFRAESTRUTURA E TOPOGRAFIA';
  const movements = [
    { sourceKey: '2025', nome: person, projeto: '516-EBSERH', year: 2025 },
    { sourceKey: '2026', nome: person, projeto: '524-PBL', year: 2026 },
    { sourceKey: 'future', nome: person, projeto: '539-AVIVA', year: 2027 },
  ];

  const result = filterTeamMovementsByPerson(person, movements, (row) => row.year <= 2026);

  assert.deepEqual(result.map((row) => row.sourceKey), ['2025', '2026']);
});

test('normaliza acentos, espaços e prefixo fiscal na identificação do beneficiário', () => {
  assert.equal(
    matchesTeamParty('Construtora São João Ltda', '12.345.678 Construtora Sao Joao Ltda'),
    true,
  );
  assert.equal(matchesTeamParty('M V LOPES PROJETOS', 'OUTRA EMPRESA LTDA'), false);
});
