import mongoose from 'mongoose';

const EntrySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  day: { type: Number, default: null }, // numéro du jour de la croisade (1, 2, 3...), null pour un culte
  count: { type: Number, required: true, min: 0 },
  submittedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Entry || mongoose.model('Entry', EntrySchema);
