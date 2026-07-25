const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { isValidEmail } = require('../utils/validators');

const JWT_SECRET = process.env.JWT_SECRET || 'devforge_ai_super_secret_jwt_key_2026_cse_project';

const generateToken = (userId, email) => {
  try {
    return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
  } catch (err) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ id: userId, email, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 })
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }
};

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

const register = asyncHandler(async (req, res) => {
  const { full_name, email, password, confirm_password } = req.body;

  if (!full_name || !email || !password) {
    throw new ApiError(400, 'Full name, email, and password are required fields.');
  }

  if (confirm_password && password !== confirm_password) {
    throw new ApiError(400, 'Passwords do not match.');
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long.');
  }

  const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(password);
  const newUser = await db.query(
    'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, created_at',
    [full_name.trim(), email.trim().toLowerCase(), passwordHash]
  );

  const user = newUser.rows[0];
  const token = generateToken(user.id, user.email);

  res.status(201).json({
    success: true,
    message: 'Account registered successfully.',
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      created_at: user.created_at
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const userRes = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
  if (userRes.rows.length === 0) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = userRes.rows[0];
  const isMatch = await comparePassword(password, user.password_hash);

  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = generateToken(user.id, user.email);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      created_at: user.created_at
    }
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

module.exports = {
  register,
  login,
  getMe
};
