const Router = require('koa-router');
const router = new Router();
let orders = require('../data/orders');

// =====================
// 查询订单
// =====================
router.get('/list', async (ctx) => {
  let { state, mark, keyword } = ctx.query;

  let result = orders.filter(o => {

    // 过滤删除
    if (o.state === -1) return false;

    if (state !== undefined && Number(state) !== o.state) return false;
    if (mark !== undefined && Number(mark) !== o.mark) return false;

    if (keyword) {
      return o.orderNo.includes(keyword) || o.client.includes(keyword);
    }

    return true;
  });

  ctx.body = {
    count: result.length,
    data: result
  };
});


// =====================
// 修改状态 mark
// =====================
router.post('/updateMark', async (ctx) => {
  let { orderId, newMark } = ctx.request.body;

  let order = orders.find(o => o.id == orderId);

  if (!order) {
    ctx.body = { success: false, msg: "订单不存在" };
    return;
  }

  order.mark = Number(newMark);

  ctx.body = {
    success: true,
    msg: "状态更新成功",
    data: order
  };
});


// =====================
// 删除订单（逻辑删除）
// =====================
router.post('/delete', async (ctx) => {
  let { orderId } = ctx.request.body;

  let order = orders.find(o => o.id == orderId);

  if (!order) {
    ctx.body = { success: false };
    return;
  }

  order.state = -1;

  ctx.body = { success: true };
});


// =====================
// 添加备注
// =====================
router.post('/remark', async (ctx) => {
  let { orderId, remark } = ctx.request.body;

  let order = orders.find(o => o.id == orderId);

  if (!order) {
    ctx.body = { success: false };
    return;
  }

  order.remark = remark;
  order.mark = 4;

  ctx.body = { success: true, data: order };
});


module.exports = router;