import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authorization';
import { PREVIEW_COOKIE } from '@/lib/designPreview';

export async function POST(request) {
  const access = await requireAdmin();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers });
  if (access.user.mustChangePass) return NextResponse.json({ error: 'Atualize sua senha antes de continuar.' }, { status: 403, headers });
  // JSON + same-origin browser requests prevent cross-site preference changes.
  if (request.headers.get('sec-fetch-site') === 'cross-site' || !request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 403, headers });
  }
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers }); }
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Informe enabled como booleano.' }, { status: 400, headers });
  const response = NextResponse.json({ enabled: body.enabled }, { headers });
  response.cookies.set(PREVIEW_COOKIE, body.enabled ? `ameba:${access.user.id}` : '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/',
    maxAge: body.enabled ? 86400 : 0,
  });
  return response;
}
