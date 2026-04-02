module.exports = {
  server: '127.0.0.1',
  port: 1433,
  user: 'sa',
  password: '123456',
  database: 'AI_Agent',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};