async function readJsonResponse(response) {
  const body = await response.text();
  const status = Number(response.status) || 0;

  if (!body.trim()) {
    throw new Error(status >= 500
      ? `Servidor temporariamente indisponível (HTTP ${status}). Aguarde alguns segundos e tente novamente.`
      : 'O servidor não concluiu a resposta. Tente novamente em alguns segundos.');
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    if (status === 502 || status === 503 || status === 504 || /^\s*</.test(body)) {
      throw new Error(`Servidor temporariamente indisponível (HTTP ${status || 502}). Os dados não foram apagados; tente novamente em alguns segundos.`);
    }
    throw new Error('O servidor retornou uma resposta inválida. Tente novamente em alguns segundos.');
  }

  if (!response.ok) {
    throw new Error(data.refreshError || data.details?.message || data.error || `Não foi possível carregar os dados (HTTP ${status}).`);
  }

  return data;
}

export async function requestJson(url) {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  return readJsonResponse(response);
}

export async function readSession() {
  return requestJson('/api/session');
}

export async function readFinancialMetadata() {
  return requestJson('/api/sync?metadata=1');
}

export async function refreshFinancialData({ manual = false } = {}) {
  return requestJson(`/api/sync?refresh=1${manual ? '&manual=1' : ''}`);
}

export async function loadFinancialData({ refresh = false, manual = false } = {}) {
  let snapshot = null;
  let snapshotError = null;
  let refreshError = null;
  let refreshedAt = null;

  // A tela recebe primeiro a última base válida. Assim, mesmo que o Render
  // reinicie durante uma atualização pesada, o usuário não perde os dados.
  try {
    snapshot = await requestJson('/api/sync?snapshot=1');
  } catch (error) {
    snapshotError = error;
  }

  if (!refresh) {
    if (snapshot) return snapshot;
    throw snapshotError;
  }

  if (refresh) {
    try {
      const result = await refreshFinancialData({ manual });
      refreshedAt = result.syncedAt;
    } catch (error) {
      refreshError = error;
    }
  }

  if (!refreshError) {
    try {
      snapshot = await requestJson('/api/sync?snapshot=1');
      snapshotError = null;
    } catch (error) {
      snapshotError = error;
      refreshError = error;
    }
  }

  if (!snapshot) {
    throw refreshError || snapshotError || new Error('Ainda não existe uma base financeira sincronizada.');
  }

  if (refreshedAt && snapshot.syncedAt !== refreshedAt) {
    refreshError = new Error('A base foi processada, mas a tela não recebeu a versão atualizada. Recarregue os dados.');
  }

  return {
    ...snapshot,
    refreshFailed: Boolean(refreshError),
    refreshError: refreshError?.message || null,
  };
}
