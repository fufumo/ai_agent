const Koa = require('koa');
const app = new Koa();
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser');
const logger = require('koa-logger');
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
app.use(logger());
app.use(require('koa-static')(path.join(__dirname, 'public')));

app.use(views(path.join(__dirname, 'views'), {
  extension: 'ejs'
}));

// 自定义日志
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
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