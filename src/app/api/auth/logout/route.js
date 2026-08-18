import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request) {
  await deleteSession();

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (host) {
    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return NextResponse.redirect(`${protocol}://${host}/login`, { status: 303 });
  }

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
