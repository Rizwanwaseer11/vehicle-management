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






// (async () => {
//   await mongoose.connect(MONGO_URI);
//   logger.info('MongoDB connected');

//   const app = express();
//   const server = http.createServer(app);

//   const allowedOrigins = [
//   'https://vehicle-management-front-end.vercel.app',
//   'http://localhost:5173',
// ];
// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
//   res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
//   res.setHeader('Access-Control-Allow-Credentials', 'true');

//   if (req.method === 'OPTIONS') return res.sendStatus(204);
//   next();
// });

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

//   / ----- Global Rate Limiter for /api -----
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests from this IP, try later.',
// });

  
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
const routes = require('./routes');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

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
const allowedOrigins = [
  'https://vehicle-management-front-end.vercel.app',
  'http://localhost:5173',
];

(async () => {
  // Connect MongoDB
  await mongoose.connect(MONGO_URI);
  logger.info('MongoDB connected');

  const app = express();
  const server = http.createServer(app);

  // ----- Trust proxy -----
  app.set('trust proxy', 1);

  // ----- CORS -----
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
  }));

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

  // ----- Socket.IO -----
  const io = new Server(server, { cors: { origin: '*' } });
  // // if (REDIS_URL) {
  //   const pubClient = new Redis(REDIS_URL);
  //   const subClient = pubClient.duplicate();
  //   io.adapter(createAdapter(pubClient, subClient));
  //   logger.info('Socket.IO Redis adapter enabled');
  // }

  // socketHandler(io);

  // ----- Start Server -----
  server.listen(PORT, () => logger.info(`Worker PID ${process.pid} listening on ${PORT}`));
})();

