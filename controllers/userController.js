const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
};

exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const allowedBase = ['name', 'email', 'phone', 'role', 'status', 'isActive', 'profilePic'];
    const passengerFields = ['roomNumber', 'jobSite'];
    const driverFields = ['homeAddress', 'licenseNumber'];

    const updates = {};
    allowedBase.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const nextRole = updates.role || user.role;
    if (nextRole === 'passenger') {
      passengerFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
    }

    if (nextRole === 'driver') {
      driverFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
    }

    if (updates.email && updates.email !== user.email) {
      const exists = await User.findOne({ email: updates.email, _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ message: 'Email already in use' });
    }

    if (nextRole === 'passenger') {
      const roomNumber = updates.roomNumber ?? user.roomNumber;
      const jobSite = updates.jobSite ?? user.jobSite;
      if (!roomNumber || !jobSite) {
        return res.status(400).json({ message: 'Passenger requires room number and job site.' });
      }
    }

    if (nextRole === 'driver') {
      const homeAddress = updates.homeAddress ?? user.homeAddress;
      const licenseNumber = updates.licenseNumber ?? user.licenseNumber;
      if (!homeAddress || !licenseNumber) {
        return res.status(400).json({ message: 'Driver requires home address and license number.' });
      }
    }

    Object.assign(user, updates);
    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User deleted successfully' });
};
