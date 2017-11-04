const events = require('events');
const WordstampSchema = require('shared_mongodb_api').WordstampSchema;

module.exports = (id, audiostream) => {
	var eventEmitter = new events.EventEmitter();
	
	setTimeout(() => {
		eventEmitter.emit('data', new WordstampSchema({
			"id": id,
			"word": "dummy_word",
			"start": -1,
			"end": -2,
		}));
		eventEmitter.emit('data', new WordstampSchema({
			"id": id,
			"word": "DONT_USE",
			"start": -1,
			"end": -2,
		}));
		eventEmitter.emit('end');
	}, 1000);

	return eventEmitter;
};
