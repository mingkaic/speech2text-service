const mongoose = require('mongoose');

const WordStampSchema = new mongoose.Schema({
    "id": String,
    "word": String,
    "start": { type: Number, required: true },
    "end": { type: Number, required: true }
});

module.exports = mongoose.model('wordstamp', WordStampSchema);
