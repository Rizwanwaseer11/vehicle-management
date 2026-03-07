require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('./utils/logger');
const initScheduler = require('./utils/scheduler');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || typeof MONGO_URI !== 'string') {
  throw new Error('MONGO_URI is missing. Set it in environment variables.');
}

const shutdown = async (signal) => {
  try {
    logger.info(`[SchedulerWorker] ${signal} received, shutting down...`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('[SchedulerWorker] MongoDB connected');

    initScheduler();
    logger.info('[SchedulerWorker] Scheduler initialized');
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
})();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  logger.error(error);
});
