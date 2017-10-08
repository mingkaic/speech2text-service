const express = require('express');
const router = express.Router();

const db = require('./database');
const wordDb = require('./local_db/subtitleDb');

const s2t = require('./services/s2t');

router.get('/subtitles/:id', (req, res) => {
	var audId = req.params.id;

	wordDb.getWords(audId)
	.then((words) => {
		var reader = new Readable();
		// if there is a terminating word denoted by an empty word attribute, 
		// return completed subtitles
		if (words.some((word) => 0 === word.word.length)) { 
			reader.push(words);
			reader.push(null);
		}
		else if (words.length === 0) {
			// start speech processing
			db.getAudio(audId)
			.then((audio) => {
				var emitter = s2t(audio); // share this emitter to partial readers
				emitter.on('data', (word) => {
					// save to wordDb;
					reader.push(word);
				});
				emitter.on('end', () => {
					reader.push(null);
				});
			});
		}
		else {
			// requesting subtitles midprocess
		}
		reader.pipe(res);
	})
	.catch((err) => {
		res.status(500).send(err);
	});
});

router.get('/synthesize', (req, res) => {
	var synthid = "mockSynthid";
	var script = req.body.script; 
	// format [{AudioModel.id, timestamp.begin, timestamp.end}]

	res.json(synthid);
});

module.exports = router;
