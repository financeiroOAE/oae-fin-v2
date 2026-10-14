import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authorization';
import { readCurrentSnapshot } from '@/lib/financialSync';
import { cpRows, revenueTitles } from '@/lib/managementSources';
import { auditFinancialNomenclatures } from '@/lib/financialNomenclatureAudit';

const fail = (error, status) => NextResponse.json({error}, {status, headers:{'Cache-Control':'private, no-store'}});

// Auditoria somente leitura: não sincroniza, não altera base e não pode
// ser acessada por perfis sem papel administrativo.
export async function GET(request) {
  const access = await requireAdmin();
  if (!access.ok) return fail(access.error, access.status);
  const year = new URL(request.url).searchParams.get('year') || '2026';
  if (!/^(?:20\d{2}|todos)$/.test(year)) return fail('Informe um ano entre 2000 e 2099 ou todos.', 400);
  try {
    const snapshot = await readCurrentSnapshot();
    if (!snapshot?.payload?.data) return fail('Snapshot financeiro indisponível.', 503);
    const result = auditFinancialNomenclatures({
      sourceRows:snapshot.payload.data,
      cpRows:cpRows(snapshot),
      titles:revenueTitles(snapshot),
      year:year === 'todos' ? null : year
    });
    return NextResponse.json({
      ...result,
      snapshotAt:snapshot.updatedAt || null,
      source:'Snapshot financeiro atual: CP_GERAL e CR_GERAL',
      readOnly:true
    }, { headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    console.error('[audit:accounts]',error);
    return fail('Não foi possível auditar os dados financeiros.', 500);
  }
}
