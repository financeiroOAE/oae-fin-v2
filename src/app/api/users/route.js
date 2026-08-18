import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { MENU_DEFINITIONS, prisma, requireAdmin, serializePermissions, toSafeUser } from '@/lib/authorization';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

export async function GET() {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { username: 'asc' }] });
  return NextResponse.json({ users: users.map(toSafeUser), menus: MENU_DEFINITIONS });
}

export async function POST(request) {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');

    if (!USERNAME_PATTERN.test(username)) {
      return NextResponse.json({ error: 'O usuário deve ter de 3 a 40 caracteres: letras, números, ponto, traço ou sublinhado.' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'A senha inicial deve ter entre 8 e 72 caracteres.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        displayName: displayName || null,
        passwordHash,
        role: 'USER',
        menuPermissions: serializePermissions(body.permissions),
        isActive: true,
        mustChangePass: true,
      },
    });

    return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Esse nome de usuário já existe.' }, { status: 409 });
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Não foi possível criar o usuário.' }, { status: 500 });
  }
}
