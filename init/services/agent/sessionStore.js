const store = new Map();

function createDefaultSession() {
  return {
    lastResults: [],
    lastModule: '',
    lastAction: '',
    lastArgs: {},
    updateTime: Date.now()
  };
}

function getSession(sessionId = 'default') {
  if (!store.has(sessionId)) {
    store.set(sessionId, createDefaultSession());
  }

  const session = store.get(sessionId);
  session.updateTime = Date.now();
  return session;
}

function setSession(sessionId = 'default', session = {}) {
  store.set(sessionId, {
    ...createDefaultSession(),
    ...session,
    updateTime: Date.now()
  });
}

function updateSession(sessionId = 'default', patch = {}) {
  const oldSession = getSession(sessionId);
  const nextSession = {
    ...oldSession,
    ...patch,
    updateTime: Date.now()
  };
  store.set(sessionId, nextSession);
  return nextSession;
}

function clearSession(sessionId = 'default') {
  store.delete(sessionId);
}

function clearExpiredSessions(maxAge = 30 * 60 * 1000) {
  const now = Date.now();
  for (const [key, session] of store.entries()) {
    if (!session.updateTime || (now - session.updateTime > maxAge)) {
      store.delete(key);
    }
  }
}

module.exports = {
  getSession,
  setSession,
  updateSession,
  clearSession,
  clearExpiredSessions
};