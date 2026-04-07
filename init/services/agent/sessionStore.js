const store = new Map();

// 自动清理定时任务
let cleanupTimer = null;
const CLEANUP_INTERVAL = 5 * 60 * 1000;  // 每5分钟清理一次
const SESSION_MAX_AGE = 30 * 60 * 1000;  // Session最长保留30分钟

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
    console.log(`[Session] 📝 创建新会话: ${sessionId}`);
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
  console.log(`[Session] ✏️  更新会话: ${sessionId}`);
}

function updateSession(sessionId = 'default', patch = {}) {
  const oldSession = getSession(sessionId);
  const nextSession = {
    ...oldSession,
    ...patch,
    updateTime: Date.now()
  };
  store.set(sessionId, nextSession);
  console.log(`[Session] 📤 会话数据更新: ${sessionId} (结果${nextSession.lastResults.length}条)`);
  return nextSession;
}

function clearSession(sessionId = 'default') {
  store.delete(sessionId);
  console.log(`[Session] 🗑️  会话已清除: ${sessionId}`);
}

function clearExpiredSessions(maxAge = SESSION_MAX_AGE) {
  const now = Date.now();
  let cleared = 0;
  
  for (const [key, session] of store.entries()) {
    if (!session.updateTime || (now - session.updateTime > maxAge)) {
      store.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    console.log(`[Session] 🧹 已清理 ${cleared} 个过期会话，当前存储 ${store.size} 个会话`);
  }
  
  return cleared;
}

/**
 * 启动自动清理任务（模块初始化时调用）
 */
function startAutoCleanup() {
  if (cleanupTimer) {
    return;  // 已启动
  }
  
  cleanupTimer = setInterval(() => {
    clearExpiredSessions();
  }, CLEANUP_INTERVAL);
  
  console.log(`[SessionStore] 自动清理任务已启动，清理间隔 ${CLEANUP_INTERVAL / 1000} 秒`);
}

/**
 * 停止自动清理任务
 */
function stopAutoCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[SessionStore] 自动清理任务已停止');
  }
}

/**
 * 获取当前会话数统计
 */
function getStats() {
  return {
    count: store.size,
    sessions: Array.from(store.entries()).map(([id, session]) => ({
      id,
      updateTime: new Date(session.updateTime).toISOString(),
      hasResults: session.lastResults.length > 0
    }))
  };
}

// 模块初始化时自动启动清理
startAutoCleanup();

module.exports = {
  getSession,
  setSession,
  updateSession,
  clearSession,
  clearExpiredSessions,
  startAutoCleanup,
  stopAutoCleanup,
  getStats
};