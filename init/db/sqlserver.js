const sql = require('mssql');
const dbConfig = require('../config/db');

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(dbConfig);
  return pool;
}

async function query(sqlText, params = []) {
  const p = await getPool();
  const request = p.request();

  for (const item of params) {
    request.input(item.name, item.type, item.value);
  }

  const result = await request.query(sqlText);
  return result.recordset;
}

async function execute(sqlText, params = []) {
  const p = await getPool();
  const request = p.request();

  for (const item of params) {
    request.input(item.name, item.type, item.value);
  }

  const result = await request.query(sqlText);
  return result;
}

module.exports = {
  sql,
  query,
  execute
};