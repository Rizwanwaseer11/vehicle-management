const User = require('../models/User');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Joi = require('joi');
const { sendEmail } = require('../utils/emailClient');
const { otpEmail, profileChangedEmail, passwordChangedEmail } = require('../utils/emailTemplates');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(80).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().min(7).max(20).optional(),
  currentPassword: Joi.string().min(6).optional(),
  newPassword: Joi.string().min(6).optional(),
  confirmPassword: Joi.string().min(6).optional(),
}).unknown(false);

const forgotSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(false);

const resetSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().min(6).required(),
}).unknown(false);

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create user with status 'pending'
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role,
      status: 'pending' // <-- added
    });

    // Send response to client
    res.status(201).json({
      message: 'Your account has been successfully created. Please wait for approval and contact support.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const match = await user.matchPassword(password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user status is pending
    if (user.status === 'pending') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. Please contact support.' 
      });
    }

    // Send successful login response
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details?.[0]?.message || 'Invalid input' });
    }

    const { name, email, phone, currentPassword, newPassword, confirmPassword } = value;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const changes = [];
    const oldEmail = user.email;

    if (name && name !== user.name) {
      user.name = name;
      changes.push('Name updated');
    }

    if (phone && phone !== user.phone) {
      user.phone = phone;
      changes.push('Phone number updated');
    }

    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: user._id } });
      if (exists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
      changes.push('Email updated');
    }

    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Current, new, and confirm password are required' });
      }
      const match = await user.matchPassword(currentPassword);
      if (!match) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirm password do not match' });
      }
      user.password = newPassword;
      changes.push('Password updated');
    }

    if (changes.length === 0) {
      return res.json({
        ok: true,
        message: 'No changes detected',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    }

    await user.save();

    const notifyRecipients = new Set([oldEmail, user.email].filter(Boolean));
    const html = profileChangedEmail({ name: user.name, changes });
    const text = `Your account was updated: ${changes.join(', ')}`;

    await Promise.all(
      Array.from(notifyRecipients).map((to) =>
        sendEmail({
          to,
          subject: 'Your account was updated',
          html,
          text,
        }).catch((err) => console.error('[email] updateProfile failed', err?.message || err))
      )
    );

    if (changes.some((c) => c.toLowerCase().includes('password'))) {
      const passHtml = passwordChangedEmail({ name: user.name });
      await Promise.all(
        Array.from(notifyRecipients).map((to) =>
          sendEmail({
            to,
            subject: 'Password changed',
            html: passHtml,
            text: 'Your password was changed successfully.',
          }).catch((err) => console.error('[email] password change failed', err?.message || err))
        )
      );
    }

    res.json({
      ok: true,
      message: 'Account updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { error, value } = forgotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const { email } = value;
    const user = await User.findOne({ email });

    if (user) {
      const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
      const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await PasswordResetOtp.deleteMany({ userId: user._id });
      await PasswordResetOtp.create({
        userId: user._id,
        email: user.email,
        codeHash,
        expiresAt,
      });

      const html = otpEmail({ name: user.name, code: otp, minutes: 10 });
      await sendEmail({
        to: user.email,
        subject: 'Your password reset code',
        html,
        text: `Your password reset code is ${otp}. It expires in 10 minutes.`,
      });
    }

    res.json({
      ok: true,
      message: 'If that email exists, an OTP has been sent.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { error, value } = resetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details?.[0]?.message || 'Invalid input' });
    }

    const { email, otp, newPassword, confirmPassword } = value;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const record = await PasswordResetOtp.findOne({
      userId: user._id,
      email: user.email,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    if (record.attempts >= 5) {
      return res.status(400).json({ message: 'Too many attempts. Please request a new code.' });
    }

    const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.codeHash !== codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    record.consumedAt = new Date();
    await record.save();

    user.password = newPassword;
    await user.save();

    const html = passwordChangedEmail({ name: user.name });
    await sendEmail({
      to: user.email,
      subject: 'Password changed',
      html,
      text: 'Your password was changed successfully.',
    });

    res.json({ ok: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

