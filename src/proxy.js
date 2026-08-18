import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET || 'super_secret_key_oae_fin_v2_2026';
const key = new TextEncoder().encode(secretKey);

const permissionRoutes = [
  { prefix: '/visao-financeira', permission: 'visao_financeira' },
  { prefix: '/fluxo-caixa', permission: 'fluxo_caixa' },
  { prefix: '/projetos', permission: 'projetos' },
  { prefix: '/dre', permission: 'dre' },
  { prefix: '/atualizacao-dados', permission: 'atualizacao_dados' },
  { prefix: '/historico', permission: 'historico' },
  { prefix: '/configuracoes', permission: 'configuracoes' },
  { prefix: '/', permission: 'inicio', exact: true },
];

const permissionDestinations = [
  ['inicio', '/'],
  ['visao_financeira', '/visao-financeira'],
  ['fluxo_caixa', '/fluxo-caixa'],
  ['projetos', '/projetos'],
  ['dre', '/dre'],
  ['configuracoes', '/configuracoes'],
  ['atualizacao_dados', '/atualizacao-dados'],
  ['historico', '/historico'],
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Rotas públicas
  if (pathname.startsWith('/login') || pathname.startsWith('/acesso-negado') || pathname.startsWith('/api/login') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('oae_session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(session, key, { algorithms: ['HS256'] });
    
    // Se o usuário precisa trocar a senha e não está na tela de troca de senha (no login), redireciona
    if (payload.user?.mustChangePass && !pathname.startsWith('/login')) {
      const url = new URL('/login', request.url);
      url.searchParams.set('forceChange', 'true');
      return NextResponse.redirect(url);
    }

    if (payload.user?.isActive === false) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('oae_session');
      return response;
    }

    // Sessões antigas continuam válidas até o próximo login; novas sessões
    // carregam papel e permissões no token para a verificação otimista.
    if (payload.user?.role && payload.user.role !== 'ADMIN') {
      const permissions = Array.isArray(payload.user.permissions) ? payload.user.permissions : [];
      const route = permissionRoutes.find((item) => item.exact ? pathname === item.prefix : pathname.startsWith(item.prefix));
      if (route && !permissions.includes(route.permission)) {
        if (pathname === '/') {
          const firstAllowed = permissionDestinations.find(([permission]) => permissions.includes(permission));
          if (firstAllowed) return NextResponse.redirect(new URL(firstAllowed[1], request.url));
        }
        const url = new URL('/acesso-negado', request.url);
        url.searchParams.set('origem', pathname);
        return NextResponse.redirect(url);
      }
    }
    
    return NextResponse.next();
  } catch (error) {
    // Token inválido ou expirado
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('oae_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
