const mongoose = require('mongoose');

const WordStampSchema = new mongoose.Schema({
    "id": { type: String, unique: true },
    "word": String,
    "start": { type: Number, required: true },
    "end": { type: Number, required: true }
});

module.exports = mongoose.model('wordstamp', WordStampSchema);
