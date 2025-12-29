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
const routes = require('./routes');
const logger = require('./utils/logger');
const serverless = require('serverless-http');
const { Server } = require('socket.io');
// const Redis = require('ioredis');
// const { createAdapter } = require('@socket.io/redis-adapter');
// const socketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL;

// ----- Express App -----
const app = express();
app.set('trust proxy', 1); // for correct IPs behind proxies

// ----- CORS -----
const allowedOrigins = [
  'https://vehicle-management-front-end.vercel.app',
  'http://localhost:5173',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ----- Core Middlewares -----
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// ----- Landing Page & Health Check (No rate limit) -----
app.get('/', (req, res) => res.type('text').send('Welcome to the cab booking server!'));
app.get('/health', (req, res) => res.json({ ok: true }));

// ----- Global Rate Limiter (All /api requests) -----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
const allowOptions = (limiter) => (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return limiter(req, res, next);
};
app.use('/api', allowOptions(limiter));

// ----- API Routes -----
app.use('/api', routes);

// ----- Global Error Handler -----
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

// ----- MongoDB Connect & Local Server Start -----
(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB connected');

    // Only listen locally, serverless will handle in Vercel
    if (process.env.NODE_ENV !== 'production') {
      server.listen(PORT, () => {
        logger.info(`Worker PID ${process.pid} listening on ${PORT}`);
      });
    }
  } catch (error) {
    logger.error('MongoDB connection error:', error);
  }
})();

// ----- Export for Vercel -----
module.exports.handler = serverless(app);
