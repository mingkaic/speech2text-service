const mongoose = require('mongoose');

const SubtitleSchema = new mongoose.Schema({
    "id": String,
    "script": [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'wordstamp'
    }]
});

module.exports = mongoose.model('subtitle', SubtitleSchema);
