const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 确保logs目录存在
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 创建logger实例
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // 控制台输出 - 使用简化格式便于阅读
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}] ${message}`;
        })
      )
    }),
    // 文件输出 - 完整的JSON格式
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;
