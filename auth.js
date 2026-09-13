import jwt from 'jsonwebtoken';

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET manquant dans les variables d\'environnement');
  }
  return secret;
}

export function signAdminToken() {
  return jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: '30d' });
}

export function verifyAdminToken(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;
  const payload = token && verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}
