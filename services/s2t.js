const events = require('events');

module.exports = (audiostream) => {
    var eventEmitter = new events.EventEmitter();
    
    eventEmitter.emit('data', "dummy word");
    eventEmitter.emit('end');

    return eventEmitter;
};
