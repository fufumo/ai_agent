const Router = require('koa-router');
const router = new Router();
const { dispatch } = require('../services/agent/dispatchService');

router.post('/dispatch', async (ctx) => {
  const { text, sessionId } = ctx.request.body || {};

  const result = await dispatch(text, {
    sessionId: sessionId || 'default'
  });

  ctx.body = result;
});

module.exports = router;