require('dotenv').config();
// using reac 5 async-errors causes issues with some libraries
// require('express-async-errors');

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const routes = require('./routes');
const socketHandler = require('./sockets/socketHandler');
const logger = require('./utils/logger');
const { authLimiter, adminLimiter, userLimiter } = require('./middlewares/rateLimiter');  

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL;

(async () => {
  await mongoose.connect(MONGO_URI);
  logger.info('MongoDB connected');

  const app = express();
  const server = http.createServer(app);

  //trust proxy always first 
  app.set('trust proxy', 1);

// core middlewares
 app.use(
  cors({
    origin: [
      "https://vehicle-management-front-end.vercel.app",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined', { stream: logger.stream }));

  // Health & root (NO rate limit)
app.get('/', (req, res) => {
  res.type('text').send('Welcome to the cab booking server!');
})
app.get('/health', (req, res) => res.json({ ok: true }));
  // app.use('/api', routes);

  
    // Scoped rate limiting (PROFESSIONAL)

app.use('/api/auth', authLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api/trips', adminLimiter);
app.use('/api/buses', adminLimiter);

app.use('/api/driver', userLimiter);
app.use('/api/passenger', userLimiter);
app.use('/api/messages', userLimiter);
app.use('/api/notifications', userLimiter);

//  Routes entry point (rate limited)
 
app.use('/api', routes);

  app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ error: err.message });
  });

  const io = new Server(server, { cors: { origin: '*' } });

  // if (REDIS_URL) {
  //   const pubClient = new Redis(REDIS_URL);
  //   const subClient = pubClient.duplicate();
  //   io.adapter(createAdapter(pubClient, subClient));
  //   logger.info('Socket.IO Redis adapter enabled');
  // }

  // socketHandler(io);

  server.listen(PORT, () => logger.info(`Worker PID ${process.pid} listening on ${PORT}`));
})();
