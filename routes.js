const express = require('express');
const router = express.Router();

const db = require('./database');
const wordDb = require('./local_db/subtitleDb');

const s2t = require('./services/s2t');
const uas = require('./services/uas');

router.post('/subtitles/:id', (req, res) => {
	var audId = req.params.id;

	wordDb.getWords(audId)
	.then((words) => {
		var reader = new Readable();
		if (words.length === 0) {
			// look at uas
			uas.get_transcript(audId)
			.then((transcript) => {
				if (transcript) {
					// save transcript to wordDb;

					reader.push(transcript);
					reader.push(null);
				}
				else {
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
			});
		}
		else {
			// THERE CAN BE TWO STATES HERE: 
			// transcript is complete, or in progress

			// for now consider complete only
			reader.push(words);
			reader.push(null);
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
