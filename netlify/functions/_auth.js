const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'colombia1810-secret';

function verifyToken(event) {
  const token = event.headers['x-session-token'];
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function unauthorized() {
  return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
}

function ok(data) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}

function err(msg, code = 400) {
  return { statusCode: code, body: JSON.stringify({ error: msg }) };
}

module.exports = { verifyToken, unauthorized, ok, err, SECRET };
