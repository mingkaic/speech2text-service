const express = require('express');
const router = express.Router();
const uuidv1 = require('uuid/v1');

const db = require('./database');
const localDb = require('./local_db/subtitleDb');
const AudioSchema = require('./database/_schemas/audio_schema');

const aud = require('./services/aud');
const s2t = require('./services/s2t');

router.post('/subtitles/:id', (req, res) => {
	var audId = req.params.id;
	console.log('evaluating subtitles for', audId);

	localDb.getWords(audId)
	.then((existing_transcript) => {
		if (existing_transcript.length === 0) {
			// start speech processing
			return db.getAudio(audId)
			.then((audio) => {
				var transcript = [];
				var emitter = s2t(audId, audio); // share this emitter to partial readers
				emitter.on('data', (word) => {
					transcript = transcript.concat(word);
				});
				return new Promise((resolve, reject) => {
					emitter.on('end', () => {
						// save to localDb;
						// transcript.forEach((word) => localDb.setWord(word));
						// todo: uncomment (AFTER S2T IMPLEMENTATION) ^

						resolve(transcript);
					});

					emitter.on('error', (err) => {
						reject(err);
					});
				});
			});
		}
		return Promise.resolve(existing_transcript);
	})
	.then((transcript) => {
		res.json(transcript.map((word) => {
			return {
				"id": word.id,
				"word": word.word,
				"start": word.start,
				"end": word.end
			};
		}));
	})
	.catch((err) => {
		res.status(500).send(err);
	});
});

router.post('/synthesize', (req, res) => {
	var id = uuidv1();
	var title = id;
	// format [{id: string, word: string, start: number, end: number}]
	var script = req.body.script;
	if (0 === script.length) {
		return res.status(400).send("attempting to synthesize empty script");
	}
	aud.synthesize(script)
	.then((audio) => {
		// save audio to db
		return db.audioSave([new AudioSchema({
			"id": id,
			"source": "synthesized",
			"title": title,
			"audio": audio
		})]);
	})
	.then(() => {
		// save script to localDb
		localDb.setScript(id, script);

		res.json({"id": id, "title": title});
	})
	.catch((err) => {
		res.status(500).send(err);
	});
});

module.exports = router;
