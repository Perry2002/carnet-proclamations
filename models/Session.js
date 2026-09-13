import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['culte', 'croisade'], default: 'culte' },
  dayCount: { type: Number, default: null }, // uniquement pour type "croisade"
  slug: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
