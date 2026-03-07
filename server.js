

require('dotenv').config();
// ❌ REMOVED raw Redis/Socket imports (They are now inside utils/socket.js)
// const Redis = require('ioredis'); 
// const { createAdapter } = require('@socket.io/redis-adapter'); 
// const { Server } = require('socket.io'); 

const socketUtil = require('./utils/socket'); // ✅ ADDED: The Singleton Utility
const socketHandler = require('./sockets/socketHandler');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const logger = require('./utils/logger');
const initScheduler = require('./utils/scheduler');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const shouldRunSchedulerInApi = process.env.RUN_SCHEDULER_IN_API === 'true';

if (!MONGO_URI || typeof MONGO_URI !== 'string') {
  throw new Error('MONGO_URI is missing. Set it in environment variables.');
}

// ----- Allow OPTIONS helper -----
const allowOptions = (limiter) => (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return limiter(req, res, next);
};

// ----- Global Rate Limiter -----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, try again later.',
});

// ----- Allowed origins -----
const allowedOrigins = (process.env.CORS_ORIGINS ||
  'https://vehicle-management-front-end.vercel.app,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server and health checks without browser origin.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

(async () => {
  // Connect MongoDB
  await mongoose.connect(MONGO_URI);
  logger.info('MongoDB connected');

  const app = express();
  const server = http.createServer(app);

  // ----- Trust proxy -----
  app.set('trust proxy', 1);

  // ----- CORS -----
  app.use(cors(corsOptions));

  // ----- Core middlewares -----
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined', { stream: logger.stream }));

  // ----- Landing & Health -----
  app.get('/', (req, res) => res.type('text').send('Welcome to the cab booking server!'));
  app.get('/health', (req, res) => res.json({ ok: true }));

  // ----- Rate limiter applied only to /api -----
  app.use('/api', allowOptions(limiter));

  // ----- API Routes -----
  app.use('/api', routes);

  // ----- Error Handler -----
  app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ error: err.message });
  });

  // ============================================================
  // ✅ SOCKET.IO MANAGEMENT (Delegate to Singleton Utility)
  // ============================================================
  
  // 1. Initialize Global Socket (Handles Redis & Server Binding internally)
  const io = await socketUtil.init(server);
  logger.info('✅ Socket.io Initialized via Utility');

  // 2. Attach Logic Handler
  socketHandler(io);


  // ----- Start Server -----
  if (shouldRunSchedulerInApi) {
    initScheduler();
    logger.info('[Scheduler] Running inside API process (RUN_SCHEDULER_IN_API=true).');
  } else {
    logger.info('[Scheduler] Not started in API process. Use dedicated scheduler worker.');
  }
  
  server.listen(PORT, () => logger.info(`Worker PID ${process.pid} listening on ${PORT}`));
})();
