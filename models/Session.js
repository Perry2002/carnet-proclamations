import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['culte', 'croisade'], default: 'culte' },
  // Pour un jour de croisade uniquement : référence vers la semaine parente et numéro du jour.
  croisadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Croisade', default: null, index: true },
  day: { type: Number, default: null },
  slug: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
