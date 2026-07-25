const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'devforge_ai_super_secret_jwt_key_2026_cse_project';

const hashPassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (err) {
    return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
  }
};

const comparePassword = async (password, hash) => {
  try {
    if (hash.length === 64) {
      const check = crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
      return check === hash;
    }
    return await bcrypt.compare(password, hash);
  } catch (err) {
    return false;
  }
};

const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { full_name } = req.body;
  const userId = req.user.id;

  if (!full_name || !full_name.trim()) {
    throw new ApiError(400, 'Full name cannot be empty.');
  }

  await db.query(
    'UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [full_name.trim(), userId]
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated.',
    user: {
      ...req.user,
      full_name: full_name.trim()
    }
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const userId = req.user.id;

  if (!current_password || !new_password || !confirm_password) {
    throw new ApiError(400, 'Current password, new password, and confirm password are required.');
  }

  if (new_password !== confirm_password) {
    throw new ApiError(400, 'New password and confirm password do not match.');
  }

  if (new_password.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters long.');
  }

  const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) throw new ApiError(404, 'User not found.');

  const isMatch = await comparePassword(current_password, userRes.rows[0].password_hash);
  if (!isMatch) {
    throw new ApiError(401, 'Current password entered is incorrect.');
  }

  const newHash = await hashPassword(new_password);
  await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId]);

  res.status(200).json({
    success: true,
    message: 'Password changed.'
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword
};
