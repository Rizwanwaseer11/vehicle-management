const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const DriverLocation = require('../models/DriverLocation');

module.exports = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Not authorized'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.userId);
    socket.join(socket.userId);

    // Chat
    socket.on('chat:send', async ({ receiverId, text }) => {
      const message = await Message.create({ sender: socket.userId, receiver: receiverId, text });
      io.to(receiverId).emit('chat:receive', message);
      socket.emit('chat:receive', message); // echo to sender
    });

    // Driver location updates
    socket.on('driver:location:update', async ({ tripId, latitude, longitude }) => {
      await DriverLocation.findOneAndUpdate(
        { driver: socket.userId, trip: tripId },
        { latitude, longitude, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      io.to(tripId).emit('driver:location', { driverId: socket.userId, latitude, longitude });
    });

    socket.on('disconnect', () => console.log('Socket disconnected:', socket.userId));
  });
};
