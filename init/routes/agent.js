const Router = require('koa-router');
const router = new Router();
const { dispatch } = require('../services/agent/dispatchService');

router.post('/dispatch', async (ctx) => {
  try {
    const { text } = ctx.request.body || {};

    if (!text || !String(text).trim()) {
      ctx.body = {
        success: false,
        msg: 'text 不能为空'
      };
      return;
    }

    const result = await dispatch(text);
    ctx.body = result;
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      msg: err.message
    };
  }
});

module.exports = router;