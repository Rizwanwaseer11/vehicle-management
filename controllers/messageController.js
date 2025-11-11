const Message = require('../models/Message');

exports.sendMessage = async (req, res) => {
  const { receiverId, text } = req.body;
  const message = await Message.create({
    sender: req.user._id,
    receiver: receiverId,
    text
  });
  res.status(201).json(message);
};

exports.getMessages = async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id }
    ]
  }).sort({ createdAt: 1 });
  res.json(messages);
};
