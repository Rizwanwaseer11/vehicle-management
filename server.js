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

// allow options to bypass rate limitor
const allowOptions = (limiter) => {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return limiter(req, res, next);
  };
};

(async () => {
  await mongoose.connect(MONGO_URI);
  logger.info('MongoDB connected');

  const app = express();
  const server = http.createServer(app);

  //trust proxy always first 
  app.set('trust proxy', 1);

// core middlewares
const allowedOrigins = [
  'https://vehicle-management-front-end.vercel.app',
  'http://localhost:5173'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman / server-to-server
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // ❌ DO NOT throw error
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// MUST be before routes
app.options('*', cors());

 
// app.use(
//   cors({
//     origin: [
//       "https://vehicle-management-front-end.vercel.app",
//       "http://localhost:5173"
//     ],
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true
//   })
// );

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

app.use('/api/auth', allowOptions(authLimiter));
app.use('/api/admin', allowOptions(adminLimiter));
app.use('/api/trips', allowOptions(adminLimiter));
app.use('/api/buses', allowOptions(adminLimiter));

app.use('/api/driver', allowOptions(userLimiter));
app.use('/api/passenger', allowOptions(userLimiter));
app.use('/api/messages', allowOptions(userLimiter));
app.use('/api/notifications', allowOptions(userLimiter));

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
