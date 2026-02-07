// const Message = require('../models/Message');

// exports.sendMessage = async (req, res) => {
//   const { receiverId, text } = req.body;
//   const message = await Message.create({
//     sender: req.user._id,
//     receiver: receiverId,
//     text
//   });
//   res.status(201).json(message);
// };

// exports.getMessages = async (req, res) => {
//   const { userId } = req.params;
//   const messages = await Message.find({
//     $or: [
//       { sender: req.user._id, receiver: userId },
//       { sender: userId, receiver: req.user._id }
//     ]
//   }).sort({ createdAt: 1 });
//   res.json(messages);
// };


// controllers/messageController.js
const mongoose = require('mongoose');
const Message = require('../models/Message');

// POST /api/messages
// Body: { tripId, receiverId?, text, clientMessageId }
exports.sendMessage = async (req, res) => {
  const { tripId, receiverId = null, text, clientMessageId } = req.body;

  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    return res.status(400).json({ error: 'Invalid tripId' });
  }
  if (!text || String(text).trim().length === 0) {
    return res.status(400).json({ error: 'Empty text' });
  }
  if (!clientMessageId) {
    return res.status(400).json({ error: 'clientMessageId required' });
  }
  if (receiverId && !mongoose.isValidObjectId(receiverId)) {
    return res.status(400).json({ error: 'Invalid receiverId' });
  }

  // TODO: Authorize trip membership here (same logic as socket)
  // if (!(await canJoinTrip(...))) return res.status(403).json({ error: 'Not allowed' });

  let message;
  try {
    message = await Message.create({
      trip: tripId,
      sender: req.user._id,
      receiver: receiverId || null,
      text: String(text).trim(),
      clientMessageId
    });
  } catch (e) {
    if (e && e.code === 11000) {
      message = await Message.findOne({ sender: req.user._id, clientMessageId });
    } else {
      throw e;
    }
  }

  await message.populate('sender', 'name role');
  return res.status(201).json(message);
};

// GET /api/messages/trip/:tripId?cursor=<isoDate>&limit=30
exports.getTripMessages = async (req, res) => {
  const { tripId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
  const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    return res.status(400).json({ error: 'Invalid tripId' });
  }

  // TODO: authorize trip membership

  const filter = { trip: tripId, receiver: null };
  if (cursor) filter.createdAt = { $lt: cursor };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name role');

  // return oldest->newest for UI
  messages.reverse();

  const nextCursor = messages.length ? messages[0].createdAt.toISOString() : null;
  res.json({ items: messages, nextCursor });
};

// GET /api/messages/dm/:tripId/:otherUserId?cursor=&limit=30
exports.getTripDM = async (req, res) => {
  const { tripId, otherUserId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
  const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

  if (!mongoose.isValidObjectId(tripId) || !mongoose.isValidObjectId(otherUserId)) {
    return res.status(400).json({ error: 'Invalid ids' });
  }

  // TODO: authorize trip membership (both users must be part of trip)

  const filter = {
    trip: tripId,
    receiver: { $ne: null },
    $or: [
      { sender: req.user._id, receiver: otherUserId },
      { sender: otherUserId, receiver: req.user._id }
    ]
  };
  if (cursor) filter.createdAt = { $lt: cursor };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name role');

  messages.reverse();

  const nextCursor = messages.length ? messages[0].createdAt.toISOString() : null;
  res.json({ items: messages, nextCursor });
};
