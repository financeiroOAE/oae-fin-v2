import { gzipSync, gunzipSync } from 'node:zlib';

/**
 * Mantém compatibilidade com snapshots JSON legados.
 * A compressão reduz o payload transferido ao banco e libera a aplicação
 * de grandes cópias temporárias do JSON na camada do Prisma.
 */
const COMPRESSED_PREFIX = 'OAE_FIN_GZIP_V1:';

export function isCompressedFinancialSnapshot(payload) {
  return typeof payload === 'string' && payload.startsWith(COMPRESSED_PREFIX);
}

export function encodeFinancialSnapshot(data) {
  // A string JSON existe somente dentro desta função e não fica retida
  // pelo fluxo que executa a gravação no banco.
  const serialized = JSON.stringify(data);
  const compressed = gzipSync(Buffer.from(serialized, 'utf8'), { level: 2 });
  return COMPRESSED_PREFIX + compressed.toString('base64');
}

export function decodeFinancialSnapshot(payload) {
  if (!isCompressedFinancialSnapshot(payload)) return payload;
  const compressed = Buffer.from(payload.slice(COMPRESSED_PREFIX.length), 'base64');
  return gunzipSync(compressed).toString('utf8');
}

/**
 * A rota /api/sync envia o gzip diretamente ao navegador, que descompacta
 * de forma nativa antes de response.text()/JSON.parse(). Isso evita que o
 * Next/Render infle o JSON inteiro apenas para responder à requisição.
 */
export function snapshotHttpPayload(payload) {
  if (!isCompressedFinancialSnapshot(payload)) {
    return { body: payload, contentEncoding: null };
  }
  const compressed = Buffer.from(payload.slice(COMPRESSED_PREFIX.length), 'base64');
  return { body: compressed, contentEncoding: 'gzip' };
}
