// require('dotenv').config();
// // using reac 5 async-errors causes issues with some libraries
// // require('express-async-errors');

// const express = require('express');
// const http = require('http');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const helmet = require('helmet');
// const compression = require('compression');
// const morgan = require('morgan');
// const rateLimit = require('express-rate-limit');
// const { Server } = require('socket.io');
// const Redis = require('ioredis');
// const { createAdapter } = require('@socket.io/redis-adapter');
// const routes = require('./routes');
// const socketHandler = require('./sockets/socketHandler');
// const logger = require('./utils/logger');
// // const { authLimiter, adminLimiter, userLimiter } = require('./middlewares/rateLimiter');  

// const PORT = process.env.PORT || 5000;
// const MONGO_URI = process.env.MONGO_URI;
// const REDIS_URL = process.env.REDIS_URL;


// // ----- Global Rate Limiter (All API requests) -----
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // max 100 requests per IP per window
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests from this IP, please try again later.'
// });

// // ----- Allow OPTIONS to bypass rate limiter -----
// const allowOptions = (limiter) => (req, res, next) => {
//   if (req.method === 'OPTIONS') return res.sendStatus(204);
//   return limiter(req, res, next);
// };

// (async () => {
//   await mongoose.connect(MONGO_URI);
//   logger.info('MongoDB connected');

//   const app = express();
//   const server = http.createServer(app);

//   //trust proxy always first 
//   app.set('trust proxy', 1);

// //core middlewares
//  app.use(cors()); // Allow all origins
//   // app.options('*', cors()); // Preflight request  ---- troubling in options 

//   app.use(helmet());
//   app.use(compression());
//   app.use(express.json());
//   app.use(express.urlencoded({ extended: true }));
//   app.use(morgan('combined', { stream: logger.stream }));

//   // Health & root (NO rate limit)
// app.get('/', (req, res) => {
//   res.type('text').send('Welcome to the cab booking server!');
// })
// app.get('/health', (req, res) => res.json({ ok: true }));
//   // app.use('/api', routes);

  
//     // / ----- Apply global rate limiter ONLY to /api routes -----
//   app.use('/api', allowOptions(limiter));

//   // ----- API Routes -----
//   app.use('/api', routes);


//   app.use((err, req, res, next) => {
//     logger.error(err);
//     res.status(500).json({ error: err.message });
//   });

//   const io = new Server(server, { cors: { origin: '*' } });

//   // if (REDIS_URL) {
//   //   const pubClient = new Redis(REDIS_URL);
//   //   const subClient = pubClient.duplicate();
//   //   io.adapter(createAdapter(pubClient, subClient));
//   //   logger.info('Socket.IO Redis adapter enabled');
//   // }

//   // socketHandler(io);

//   server.listen(PORT, () => logger.info(`Worker PID ${process.pid} listening on ${PORT}`));
// })();


require('dotenv').config();
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

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL;

// ----- Global Rate Limiter (All API requests) -----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

// ----- Allow OPTIONS to bypass rate limiter -----
const allowOptions = (limiter) => (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return limiter(req, res, next);
};

// ----- Express App -----
const app = express();
app.set('trust proxy', 1); // For real IPs behind proxies

// Core middlewares
app.use(cors());          // Global CORS, handles preflight
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// Landing & health routes (NO rate limit)
app.get('/', (req, res) => res.type('text').send('Welcome to the cab booking server!'));
app.get('/health', (req, res) => res.json({ ok: true }));

// Apply global rate limiter ONLY to /api
app.use('/api', allowOptions(limiter));

// API routes
app.use('/api', routes);

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ----- Socket.IO -----
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// if (REDIS_URL) {
//   const pubClient = new Redis(REDIS_URL);
//   const subClient = pubClient.duplicate();
//   io.adapter(createAdapter(pubClient, subClient));
//   logger.info('Socket.IO Redis adapter enabled');
// }

// socketHandler(io);

// ----- MongoDB Connect & Start Server -----
(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB connected');

    if (process.env.NODE_ENV !== 'production') {
      server.listen(PORT, () => {
        logger.info(`Worker PID ${process.pid} listening on ${PORT}`);
      });
    }
  } catch (error) {
    logger.error('MongoDB connection error:', error);
  }
})();

// ----- Export app for Vercel serverless -----
const serverless = require('serverless-http');
module.exports.handler = serverless(app);
