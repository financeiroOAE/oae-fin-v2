import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  refreshFinancialSnapshot,
  registerSyncError,
} from '@/lib/financialSync';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks')
);
const AUDIENCE = 'oae-fin-daily-sync';
const EXPECTED_REPOSITORY = 'financeiroOAE/oae-fin-v2';
const EXPECTED_WORKFLOW_REF =
  'financeiroOAE/oae-fin-v2/.github/workflows/daily-financial-sync.yml@refs/heads/main';

async function verifyGitHubActionsToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Token OIDC ausente');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const { payload } = await jwtVerify(token, GITHUB_JWKS, {
    issuer: GITHUB_ISSUER,
    audience: AUDIENCE,
    algorithms: ['RS256'],
  });

  if (payload.repository !== EXPECTED_REPOSITORY) {
    throw new Error('Repositório OIDC não autorizado');
  }

  if (payload.workflow_ref !== EXPECTED_WORKFLOW_REF) {
    throw new Error('Workflow OIDC não autorizado');
  }

  if (!['schedule', 'workflow_dispatch'].includes(String(payload.event_name || ''))) {
    throw new Error('Evento OIDC não autorizado');
  }

  return payload;
}

export async function POST(request) {
  try {
    const oidc = await verifyGitHubActionsToken(request);
    const payload = await refreshFinancialSnapshot('AUTO_16:30');

    return NextResponse.json({
      success: true,
      syncedAt: payload.syncedAt,
      recordsCount: payload.recordsCount,
      triggeredBy: 'AUTO_16:30',
      githubRunId: oidc.run_id || null,
    });
  } catch (error) {
    const isAuthError = /OIDC|Token|Repositório|Workflow|Evento/.test(
      String(error?.message || '')
    );

    if (!isAuthError) {
      await registerSyncError('AUTO_16:30', error);
    }

    return NextResponse.json(
      {
        error: isAuthError
          ? 'Agendamento não autorizado'
          : 'Falha na sincronização automática',
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
