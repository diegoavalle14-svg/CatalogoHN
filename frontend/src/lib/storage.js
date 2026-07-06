const SESSION_KEY = 'catalogohn.session';
const UI_STATE_KEY = 'catalogohn.ui';

function isTemporarySession(session) {
  return Boolean(session?.temporary_session || session?.impersonated_from);
}

export function loadSession() {
  try {
    const sessionValue = sessionStorage.getItem(SESSION_KEY);
    if (sessionValue) return JSON.parse(sessionValue);
    const persisted = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (isTemporarySession(persisted)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return persisted;
  } catch {
    return null;
  }
}

export function bootstrapSessionFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('session');
    if (!encoded) return null;
    const session = {
      ...JSON.parse(decodeURIComponent(encoded)),
      temporary_session: true,
      temporary_started_at: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    url.searchParams.delete('session');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  if (isTemporarySession(session)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearTemporarySession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function loadUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveUiState(state) {
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(state || {}));
}

export function updateUiState(updater) {
  const current = loadUiState();
  const nextState = typeof updater === 'function'
    ? updater(current)
    : { ...current, ...(updater || {}) };
  saveUiState(nextState);
  return nextState;
}

export function clearUiState() {
  localStorage.removeItem(UI_STATE_KEY);
}

export function getCartKey(clientId) {
  return `catalogohn.kolben.cart.${clientId}`;
}

export function loadCart(clientId) {
  if (!clientId) return {};
  try {
    // Limpiar carrito genérico viejo si existe (migración)
    const legacyKey = 'catalogohn.kolben.cart';
    if (localStorage.getItem(legacyKey)) {
      localStorage.removeItem(legacyKey);
    }
    return JSON.parse(localStorage.getItem(getCartKey(clientId))) || {};
  } catch {
    return {};
  }
}

export function saveCart(clientId, cart) {
  if (!clientId) return;
  localStorage.setItem(getCartKey(clientId), JSON.stringify(cart));
}

export function clearCart(clientId) {
  if (!clientId) return;
  localStorage.removeItem(getCartKey(clientId));
}
