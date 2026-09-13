import mongoose from 'mongoose';

const EntrySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  count: { type: Number, required: true, min: 0 },
  submittedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Entry || mongoose.model('Entry', EntrySchema);
