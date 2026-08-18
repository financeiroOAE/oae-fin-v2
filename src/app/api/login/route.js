import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { createSession } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { username, password, newPassword } = await request.json();

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Usuário desativado. Procure o administrador.' }, { status: 403 });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (user.mustChangePass) {
      if (!newPassword) {
        return NextResponse.json({ mustChangePass: true, error: 'Troca de senha obrigatória' }, { status: 403 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'A nova senha deve ter no mínimo 8 caracteres' }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, mustChangePass: false },
      });
      
      user.mustChangePass = false;
    }

    // Cria a sessão com JWT
    let permissions = [];
    try { permissions = JSON.parse(user.menuPermissions || '[]'); } catch { permissions = []; }
    const sessionPayload = {
      id: user.id,
      username: user.username,
      displayName: user.displayName || '',
      role: user.role,
      permissions: Array.isArray(permissions) ? permissions : [],
      isActive: user.isActive,
      mustChangePass: user.mustChangePass,
    };
    await createSession(sessionPayload);

    return NextResponse.json({ success: true, message: 'Autenticado com sucesso' });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
