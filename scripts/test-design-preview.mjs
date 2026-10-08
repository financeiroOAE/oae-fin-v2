// Run: node --experimental-vm-modules scripts/test-design-preview.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
const policy = new vm.SourceTextModule(await readFile('src/lib/designPreview.js', 'utf8'), { context });
await policy.link(() => {});
await policy.evaluate();
const { isPreviewEnabled } = policy.namespace;
const admin = { id: 'admin-a', role: 'ADMIN', isActive: true, mustChangePass: false };
assert.equal(isPreviewEnabled(admin, 'ameba:admin-a'), true);
for (const user of [null, { ...admin, role: 'USER' }, { ...admin, isActive: false }, { ...admin, mustChangePass: true }, { ...admin, id: 'admin-b' }]) {
  assert.equal(isPreviewEnabled(user, 'ameba:admin-a'), false);
}
assert.equal(isPreviewEnabled(admin, undefined), false);

let access;
const auth = new vm.SyntheticModule(['requireAdmin'], function () {
  this.setExport('requireAdmin', async () => access);
}, { context });
const next = new vm.SyntheticModule(['NextResponse'], function () {
  this.setExport('NextResponse', { json: (body, options = {}) => {
    const writes = [];
    return { body, status: options.status || 200, headers: options.headers, writes, cookies: { set: (...args) => writes.push(args) } };
  } });
}, { context });
context.process = { env: { NODE_ENV: 'production' } };
const route = new vm.SourceTextModule(await readFile('src/app/api/design-preview/route.js', 'utf8'), { context });
await route.link((specifier) => ({ 'next/server': next, '@/lib/authorization': auth, '@/lib/designPreview': policy })[specifier]);
await route.evaluate();
const request = (body, site = 'same-origin', contentType = 'application/json') => ({
  headers: { get: (key) => ({ 'sec-fetch-site': site, 'content-type': contentType })[key] },
  json: async () => body,
});
for (const status of [401, 403]) {
  access = { ok: false, status, error: 'Bloqueado' };
  const response = await route.namespace.POST(request({ enabled: true }));
  assert.equal(response.status, status);
  assert.equal(response.writes.length, 0);
}
access = { ok: true, user: admin };
for (const req of [request({ enabled: true }, 'cross-site'), request({ enabled: true }, 'same-origin', 'text/plain')]) {
  assert.equal((await route.namespace.POST(req)).status, 403);
}
assert.equal((await route.namespace.POST(request({ enabled: 'true' }))).status, 400);
assert.equal((await route.namespace.POST(request(null))).status, 400);
const enabled = await route.namespace.POST(request({ enabled: true }));
assert.equal(enabled.status, 200);
assert.equal(enabled.writes[0][1], 'ameba:admin-a');
assert.equal(enabled.writes[0][2].httpOnly, true);
assert.equal(enabled.writes[0][2].secure, true);
assert.equal(enabled.headers['Cache-Control'], 'private, no-store');
const disabled = await route.namespace.POST(request({ enabled: false }));
assert.equal(disabled.writes[0][2].maxAge, 0);
access = { ok: true, user: { ...admin, mustChangePass: true } };
assert.equal((await route.namespace.POST(request({ enabled: true }))).status, 403);
console.log('Prévia: isolamento de conta, permissões, cookie e API validados.');
