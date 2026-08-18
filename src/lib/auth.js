import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtKey() {
  const secretKey = process.env.JWT_SECRET;

  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET não está configurado no ambiente de produção.');
    }
    return new TextEncoder().encode('dev_only_oae_fin_v2_change_me');
  }

  return new TextEncoder().encode(secretKey);
}

export async function encrypt(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getJwtKey());
}

export async function decrypt(input) {
  try {
    const { payload } = await jwtVerify(input, getJwtKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('oae_session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function createSession(user) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encrypt({ user, expires });

  const cookieStore = await cookies();
  cookieStore.set('oae_session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('oae_session');
}
