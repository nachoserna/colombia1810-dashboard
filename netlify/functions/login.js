const { getDb } = require('./_db');
const { ok, err } = require('./_auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'colombia1810-secret-2026';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return err('Invalid JSON');
  }

  const { username, password } = body;
  if (!username || !password) return err('Username and password required');

  const hash = crypto.createHash('sha256').update(password).digest('hex');

  const db = await getDb();
  const user = await db.collection('dashboard_users').findOne({ username, password: hash });

  if (!user) return err('Credenciales inválidas', 401);

  const token = jwt.sign({ username, role: user.role }, SECRET, { expiresIn: '7d' });
  return ok({ token, username, role: user.role });
};
