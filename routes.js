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
		if (words.length === 0) {
			// look at uas
			uas.get_transcript(audId)
			.then((transcript) => {
				if (transcript) {
					// save transcript to wordDb;
					transcript.forEach((word) => wordDb.setWord(word));
					// todo: make dry... this is reused 3 times
					res.json(transcript.map((word) => {
						return {
							"word": word.word,
							"start": word.start,
							"end": word.end
						};
					}));
				}
				else {
					// start speech processing
					db.getAudio(audId)
					.then((audio) => {
						transcript = [];
						var emitter = s2t(audId, audio); // share this emitter to partial readers
						emitter.on('data', (word) => {
							// save to wordDb;
							// wordDb.setWord(word); // uncomment once s2t is implemented

							transcript = transcript.concat(word);
						});
						emitter.on('end', () => {
							res.json(transcript.map((word) => {
								return {
									"word": word.word,
									"start": word.start,
									"end": word.end
								};
							}));
						});
					});
				}
			});
		}
		else {
			// THERE CAN BE TWO STATES HERE: 
			// transcript is complete, or in progress

			// for now consider complete only
			res.json(words.map((word) => {
				return {
					"word": word.word,
					"start": word.start,
					"end": word.end
				};
			}));
		}
	})
	.catch((err) => {
		res.status(500).send(err);
	});
});

router.get('/synthesize', (req, res) => {
	var synthid = "mockSynthid";
	var script = req.body.script; 
	// format [{id: string, begin: number, end: number}]

	res.json(synthid);
});

module.exports = router;
