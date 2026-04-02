const Koa = require('koa');
const app = new Koa();
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser');
const logger = require('./config/logger');
const path = require('path');
const fs = require('fs');
const Router = require('koa-router');

const router = new Router();
// error handler
onerror(app);

// middlewares
app.use(bodyparser({
  enableTypes: ['json', 'form', 'text']
}));

app.use(json());
app.use(require('koa-static')(path.join(__dirname, 'public')));

app.use(views(path.join(__dirname, 'views'), {
  extension: 'ejs'
}));

// 增强日志中间件 - 记录请求方法、URL、状态码、POST请求体和响应时间
app.use(async (ctx, next) => {
  const start = Date.now();
  
  // 记录请求信息
  const requestInfo = {
    method: ctx.method,
    url: ctx.url,
    ip: ctx.ip
  };
  
  // 如果是POST/PUT/PATCH请求，记录请求体
  if (['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
    requestInfo.body = ctx.request.body;
  }
  
  try {
    await next();
  } catch (err) {
    // 错误会由koa-onerror处理
    throw err;
  }
  
  const ms = Date.now() - start;
  
  // 组织日志信息
  const logMessage = `${ctx.method} ${ctx.url} - Status: ${ctx.status} - ${ms}ms`;
  const logData = {
    method: ctx.method,
    url: ctx.url,
    status: ctx.status,
    responseTime: `${ms}ms`,
    ...requestInfo
  };
  
  // 根据状态码选择日志级别
  if (ctx.status >= 500) {
    logger.error(logMessage, logData);
  } else if (ctx.status >= 400) {
    logger.warn(logMessage, logData);
  } else {
    logger.info(logMessage, logData);
  }
});

// 自动加载 routes 目录
const routesPath = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesPath);

files.forEach(file => {
  // 只处理 .js 文件
  if (!file.endsWith('.js')) return;

  // 跳过隐藏文件
  if (file.startsWith('.')) return;

  const fullPath = path.join(routesPath, file);
  const routeModule = require(fullPath);

  const routeName = path.basename(file, '.js');
  const prefix = `/api/${routeName}`;

  if (routeModule && typeof routeModule.routes === 'function') {
    router.use(prefix, routeModule.routes(), routeModule.allowedMethods());
    console.log(`已挂载路由: ${prefix} -> ${file}`);
  } else {
    console.log(`跳过非 router 模块: ${file}`);
  }
});

// 挂到 app
app.use(router.routes());
app.use(router.allowedMethods());

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx);
});

module.exports = app;