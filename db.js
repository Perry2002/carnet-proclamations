import mongoose from 'mongoose';

// En environnement serverless (Vercel), chaque invocation peut réutiliser
// une instance déjà chaude : on met la connexion en cache pour éviter
// d'ouvrir une nouvelle connexion à chaque requête (limite du plan
// gratuit MongoDB Atlas M0).
const globalForMongoose = globalThis;
if (!globalForMongoose._mongooseCache) {
  globalForMongoose._mongooseCache = { conn: null, promise: null };
}
const cache = globalForMongoose._mongooseCache;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI manquant dans les variables d\'environnement');
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => m);
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
