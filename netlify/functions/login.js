const { getDb } = require('./_db');
const { ok, err, SECRET } = require('./_auth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const { username, password } = JSON.parse(event.body || '{}');
  if (!username || !password) return err('Missing credentials');

  const db = await getDb();
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = await db.collection('dashboard_users').findOne({ username, password: hash });

  if (!user) return err('Invalid credentials', 401);

  const token = jwt.sign({ username, role: user.role }, SECRET, { expiresIn: '7d' });
  return ok({ token, username, role: user.role });
};
