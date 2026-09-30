async function readJsonResponse(response) {
  const body = await response.text();

  if (!body.trim()) {
    throw new Error('O servidor não concluiu a resposta. Tente novamente em alguns segundos.');
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('O servidor retornou uma resposta incompleta. Tente novamente em alguns segundos.');
  }

  if (!response.ok) {
    throw new Error(data.refreshError || data.details?.message || data.error || 'Não foi possível atualizar os dados.');
  }

  return data;
}

async function requestJson(url) {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  return readJsonResponse(response);
}

export async function readSession() {
  return requestJson('/api/session');
}

export async function refreshFinancialData() {
  return requestJson('/api/sync?refresh=1');
}

export async function loadFinancialData({ refresh = false } = {}) {
  let refreshError = null;
  let refreshedAt = null;

  if (refresh) {
    try {
      const result = await refreshFinancialData();
      refreshedAt = result.syncedAt;
    } catch (error) {
      refreshError = error;
    }
  }

  const snapshot = await requestJson('/api/sync?snapshot=1');

  if (refreshedAt && snapshot.syncedAt !== refreshedAt) {
    refreshError = new Error('A base foi processada, mas a tela não recebeu a versão atualizada. Recarregue os dados.');
  }

  return {
    ...snapshot,
    refreshFailed: Boolean(refreshError),
    refreshError: refreshError?.message || null,
  };
}
