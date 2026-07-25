const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'devforge_ai_super_secret_jwt_key_2026_cse_project';

const verifyTokenFallback = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
};

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Authentication token missing or invalid. Please log in.');
  }

  let decoded = null;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (jwtErr) {
    decoded = verifyTokenFallback(token);
  }

  if (!decoded || !decoded.id) {
    throw new ApiError(401, 'Invalid or expired authentication token.');
  }

  const userResult = await db.query('SELECT id, full_name, email, created_at FROM users WHERE id = $1', [decoded.id]);
  
  if (userResult.rows.length === 0) {
    throw new ApiError(401, 'User account associated with this token no longer exists.');
  }

  req.user = userResult.rows[0];
  next();
});

module.exports = { protect };
