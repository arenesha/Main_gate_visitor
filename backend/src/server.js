require('dotenv').config();
const app = require('./app');
const { initDatabase } = require('./database/db');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 8003;

async function startServer() {
  try {
    await initDatabase();

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`================================================================`);
      logger.info(`🛡️  Main Gate Visitor Entry Authorization System Started (v2.0)`);
      logger.info(`🌐 Backend API:          http://localhost:${PORT}/api/health`);
      logger.info(`📋 Visitor Authorization: http://localhost:${PORT}/authorization`);
      logger.info(`🚧 Gate Verification:    http://localhost:${PORT}/gate-verification`);
      logger.info(`👥 Admin Visitors:       http://localhost:${PORT}/admin/visitors`);
      logger.info(`🔑 Admin PIN Change:     http://localhost:${PORT}/admin/pin`);
      logger.info(`📊 Admin Entry Records:  http://localhost:${PORT}/admin/entries`);
      logger.info(`================================================================`);
    });

    const shutdown = () => {
      logger.info('Gracefully shutting down server...');
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
