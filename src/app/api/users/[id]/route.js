import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma, requireAdmin, serializePermissions, toSafeUser } from '@/lib/authorization';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

export async function PATCH(request, context) {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await context.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (existing.role === 'ADMIN') {
    return NextResponse.json({ error: 'O administrador principal não pode ter seu acesso alterado por esta tela.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = {};

    if (body.username !== undefined) {
      const username = String(body.username).trim();
      if (!USERNAME_PATTERN.test(username)) return NextResponse.json({ error: 'Nome de usuário inválido.' }, { status: 400 });
      data.username = username;
    }
    if (body.displayName !== undefined) data.displayName = String(body.displayName || '').trim() || null;
    if (body.permissions !== undefined) data.menuPermissions = serializePermissions(body.permissions);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.password) {
      const password = String(body.password);
      if (password.length < 8 || password.length > 72) return NextResponse.json({ error: 'A nova senha deve ter entre 8 e 72 caracteres.' }, { status: 400 });
      data.passwordHash = await bcrypt.hash(password, 10);
      data.mustChangePass = true;
    }

    const user = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ user: toSafeUser(user) });
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Esse nome de usuário já existe.' }, { status: 409 });
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o usuário.' }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await context.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (existing.role === 'ADMIN') {
    return NextResponse.json({ error: 'O administrador principal não pode ser excluído.' }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Não foi possível excluir o usuário.' }, { status: 500 });
  }
}
