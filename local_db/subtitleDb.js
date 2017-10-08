var WordModel = require('./_models/wordstamp_model');
var WordSchema = require('./_schemas/wordstamp_schema');

exports.saveWord = (word) => {
    if (null === word || 
        !(word instanceof AudioSchema)) {
        return;
    }
};

exports.getWords = (id) => {

};
