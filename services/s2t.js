const events = require('events');
const WordSchema = require('../local_db/_schemas/wordstamp_schema');

module.exports = (id, audiostream) => {
    var eventEmitter = new events.EventEmitter();
    
    setTimeout(() => {
        eventEmitter.emit('data', new WordSchema({
            "id": id,
            "word": "dummy_word",
            "start": -1,
            "end": -2,
        }));
        eventEmitter.emit('data', new WordSchema({
            "id": id,
            "word": "DONT_USE",
            "start": -1,
            "end": -2,
        }));
        eventEmitter.emit('end');
    }, 1000);

    return eventEmitter;
};
