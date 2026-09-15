require('dotenv').config();
const app = require('./backend/src/app');
const { initDatabase } = require('./backend/src/database/db');
const logger = require('./backend/src/utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 8003;

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
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
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
