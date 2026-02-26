const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const DriverLocation = require('../models/DriverLocation');
const DeviceToken = require('../models/DeviceTokens');
const { sendPushNotification } = require('../utils/fcmHelper');

// ===== Presence (in-memory for now; move to Redis when cluster enabled) =====
const userSockets = new Map(); // userId -> Set(socket.id)

function addPresence(userId, socketId) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socketId);
}
function removePresence(userId, socketId) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
}
function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

// ===== Helpers =====
const roomTrip = (tripId) => `trip:${tripId}`;
const roomTripChat = (tripId) => `trip:${tripId}:chat`;
const roomUser = (userId) => `user:${userId}`;
const roomAdmin = () => `admin_room`;

// TODO: Replace with real checks:
// - driver must be assigned to trip
// - passenger must have booking for trip
async function canJoinTrip({ userId, role, tripId }) {
  return true;
}

// Push to offline users only
async function notifyUserLater(userId, payload) {
  try {
    if (!userId || isUserOnline(userId)) return;

    const tokens = await DeviceToken.find({ userId, provider: 'fcm' })
      .select('token -_id')
      .lean();
    if (!tokens.length) return;

    const title = payload?.title || 'New message';
    const body = payload?.body || 'You have a new message';
    const data = payload?.data || payload || {};

    const tokenList = tokens.map((t) => t.token);
    const result = await sendPushNotification(tokenList, title, body, data, {
      androidPriority: 'high',
      apnsPriority: '10'
    });

    if (result?.invalidTokens?.length) {
      await DeviceToken.deleteMany({ token: { $in: result.invalidTokens } });
    }
  } catch (e) {
    console.error('notifyUserLater error:', e.message);
  }
}

module.exports = (io) => {
  // A) AUTH MIDDLEWARE
  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error('Not authorized'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // ✅ Robust: support different JWT payload shapes
      const decodedId = decoded?.id || decoded?._id || decoded?.userId;
      if (!decodedId) return next(new Error('Token invalid'));

      socket.userId = String(decodedId);

      // ✅ Robust: role fallback from token OR handshake
      socket.role = decoded?.role || socket.handshake?.auth?.role || 'user';

      next();
    } catch (err) {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Connected: ${socket.userId} (${socket.role || 'user'})`);

    // Presence + personal room
    addPresence(socket.userId, socket.id);
    socket.join(roomUser(socket.userId)); // Personal channel

    // Admin monitoring room
    if (socket.role === 'admin') {
      socket.join(roomAdmin());
      console.log('🛡️ Admin Monitoring Active');
    }

    // 1) JOIN TRIP ROOMS
    socket.on('join_trip', async ({ tripId }, ack) => {
      try {
        if (!tripId || !mongoose.isValidObjectId(tripId)) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Invalid tripId' })
            : socket.emit('error', { message: 'Invalid tripId' });
        }

        const allowed = await canJoinTrip({ userId: socket.userId, role: socket.role, tripId });
        if (!allowed) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Not allowed for this trip' })
            : socket.emit('error', { message: 'Not allowed for this trip' });
        }

        // Operational room (location, stop updates)
        socket.join(roomTrip(tripId));

        // Chat room (messages)
        socket.join(roomTripChat(tripId));

        // ✅ Role fallback again for logs (keeps logs clean)
        const role = socket.role || socket.handshake?.auth?.role || 'user';

        console.log(`👥 ${role} joined Trip rooms: ${tripId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        console.error('join_trip error:', e.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'Join failed' });
      }
    });

    // 2) LIVE TRACKING (keep in trip operational room, not chat room)
    socket.on('bus_location_update', async (data) => {
      try {
        const { tripId, lat, lng, heading, speed } = data || {};
        if (!tripId) return;

        // Broadcast to passengers & driver watchers (operational room)
        io.to(roomTrip(tripId)).emit('bus_location_update', {
          driverId: socket.userId, lat, lng, heading, speed
        });

        // Admin fleet monitoring
        io.to(roomAdmin()).emit('admin_fleet_update', {
          tripId, driverId: socket.userId, lat, lng, heading, speed
        });

        // Save location (fire & forget)
        DriverLocation.findOneAndUpdate(
          { driver: socket.userId, trip: tripId },
          { latitude: lat, longitude: lng, heading, speed, updatedAt: new Date() },
          { upsert: true, new: true }
        ).catch(e => console.error('Loc Save Err:', e.message));
      } catch (e) {
        console.error('bus_location_update error:', e.message);
      }
    });

    // 3) CHAT SEND (ACK + idempotency)
    // Client should emit: chat:send({ tripId, receiverId?, text, clientMessageId }, (ack)=>{})
    socket.on('chat:send', async (payload, ack) => {
      try {
        const { tripId, receiverId = null, text, clientMessageId } = payload || {};

        if (!tripId || !mongoose.isValidObjectId(tripId)) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Invalid tripId' })
            : socket.emit('error', { message: 'Invalid tripId' });
        }

        if (!text || String(text).trim().length === 0) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Empty message' })
            : socket.emit('error', { message: 'Empty message' });
        }

        if (!clientMessageId) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'clientMessageId required' })
            : socket.emit('error', { message: 'clientMessageId required' });
        }

        // Optional: validate receiverId if provided
        if (receiverId && !mongoose.isValidObjectId(receiverId)) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Invalid receiverId' })
            : socket.emit('error', { message: 'Invalid receiverId' });
        }

        // Authorization: only allow trip members
        const allowed = await canJoinTrip({ userId: socket.userId, role: socket.role, tripId });
        if (!allowed) {
          return typeof ack === 'function'
            ? ack({ ok: false, error: 'Not allowed for this trip' })
            : socket.emit('error', { message: 'Not allowed for this trip' });
        }

        // ✅ NOTE: idempotency requires a UNIQUE INDEX in MongoDB:
        // MessageSchema.index({ sender: 1, clientMessageId: 1 }, { unique: true })
        // Otherwise e.code===11000 will never happen.
        let message;
        try {
          message = await Message.create({
            trip: tripId,
            sender: socket.userId,
            receiver: receiverId || null,
            text: String(text).trim(),
            clientMessageId
          });
        } catch (e) {
          // If duplicate due to retry, fetch existing and treat as success
          if (e && e.code === 11000) {
            message = await Message.findOne({ sender: socket.userId, clientMessageId });
          } else {
            throw e;
          }
        }

        await message.populate('sender', 'name role');

        // Routing
        if (receiverId) {
          // Private DM via personal user rooms
          io.to(roomUser(receiverId)).emit('chat:receive', message);
          io.to(roomUser(socket.userId)).emit('chat:receive', message);

          // Push hook for offline receiver
          await notifyUserLater(receiverId, {
            title: message?.sender?.name || 'New message',
            body: message?.text || 'You have a new message',
            data: {
              type: 'CHAT_MESSAGE',
              tripId,
              messageId: message._id,
              senderId: message?.sender?._id || null
            }
          });
        } else {
          // Trip group chat
          io.to(roomTripChat(tripId)).emit('chat:receive', message);
        }

        // Admin sees all chats
        io.to(roomAdmin()).emit('admin_chat_monitor', message);

        if (typeof ack === 'function') {
          ack({ ok: true, messageId: String(message._id), createdAt: message.createdAt });
        }
      } catch (e) {
        console.error('Chat Error:', e.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'Message failed to send' });
        socket.emit('chat:error', { message: 'Message failed to send' });
      }
    });

    socket.on('disconnect', () => {
      removePresence(socket.userId, socket.id);
      // TODO: When Redis presence exists, update there instead.
    });
  });
};
