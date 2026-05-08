const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'colombia1810-secret-2026';

function verifyToken(event) {
  const token = event.headers?.['x-session-token'];
  if (!token) return false;
  try {
    jwt.verify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

function unauthorized() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Unauthorized' })
  };
}

function ok(data) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}

function err(msg, code = 400) {
  return {
    statusCode: code,
    body: JSON.stringify({ error: msg })
  };
}

module.exports = { verifyToken, unauthorized, ok, err };
