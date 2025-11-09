const mongoose = require('mongoose');

// Generic counter collection for atomic sequence generation
const CounterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', CounterSchema);