import { NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser } from '@/lib/authorization';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: toSafeUser(user) });
}
