import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectViabilityAccess } from '../src/lib/reportVisibility.mjs';

test('administrador principal visualiza e exporta', () => {
  assert.deepEqual(resolveProjectViabilityAccess({role:'ADMIN',username:'admin',isActive:true}), {canView:true,canExport:true});
});
test('usuário autorizado de projetos pode visualizar sem exportar', () => {
  assert.deepEqual(resolveProjectViabilityAccess({role:'USER',permissions:['projetos'],isActive:true}), {canView:true,canExport:false});
});
test('usuário sem projetos não recebe acesso', () => {
  assert.deepEqual(resolveProjectViabilityAccess({role:'USER',permissions:['equipe_gestao'],isActive:true}), {canView:false,canExport:false});
});
test('usuário inativo não recebe acesso', () => {
  assert.deepEqual(resolveProjectViabilityAccess({role:'ADMIN',username:'admin',isActive:false}), {canView:false,canExport:false});
});
