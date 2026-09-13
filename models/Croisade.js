import mongoose from 'mongoose';

// Une semaine de croisade est un simple conteneur : elle regroupe plusieurs
// "Session" de type croisade (une par jour), chacune avec son propre lien.
const CroisadeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  dayCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Croisade || mongoose.model('Croisade', CroisadeSchema);
