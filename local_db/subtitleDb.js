var wordModel = require('./_models/wordstamp_model');
var WordSchema = require('./_schemas/wordstamp_schema');

exports.setWord = (word) => {
    if (null === word || 
        !(word instanceof WordSchema)) {
        return;
    }

    new wordModel({
        "id": word.id,
        "word": word.word,
        "start": word.start,
        "end": word.end
    }).save();
};

exports.getWords = (id) => {
    return wordModel.find({ "id": id }).exec();
};
