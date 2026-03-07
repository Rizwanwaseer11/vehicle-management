


// utils/socket.js
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");

let io = null;

const buildRedisClient = (url) =>
  new Redis(url, {
    maxRetriesPerRequest: null, // prevent crash on retry limit
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

module.exports = {
  init: async (httpServer) => {
    if (io) return io;

    console.log("🔌 Initializing Socket.io...");

    io = new Server(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      transports: ["websocket", "polling"],

      // Better mobile stability
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    if (process.env.REDIS_URL) {
      try {
        const pubClient = buildRedisClient(process.env.REDIS_URL);
        const subClient = pubClient.duplicate();

        pubClient.on("error", (err) =>
          console.error("Redis Pub Error:", err.message),
        );
        subClient.on("error", (err) =>
          console.error("Redis Sub Error:", err.message),
        );

        io.adapter(createAdapter(pubClient, subClient));
        console.log("✅ Redis Adapter Connected");
      } catch (err) {
        console.error("❌ Redis Error (Running in Memory Mode):", err.message);
      }
    } else {
      console.log(
        "ℹ️ REDIS_URL not set: running Socket.IO in single-process memory mode.",
      );
    }

    return io;
  },

  getIO: () => {
    if (!io) {
      // In production you WANT to know this happened
      throw new Error(
        "Socket.io requested but not initialized. Call socketUtil.init(server) first.",
      );
    }
    return io;
  },
};
