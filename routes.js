const uuidv1 = require('uuid/v1');
const db = require('shared_mongodb_api');
const grpc = require('shared_grpc');

const AudioSchema = db.AudioSchema;
const WordstampSchema = db.WordstampSchema;

const aud = require('./services/aud');
const s2t = require('./services/s2t');

exports.processCaptions = (call) => {
	var audId = call.request.id;
	console.log('evaluating subtitles for', audId);

	db.captions.getWords(audId)
	.then((existing_transcript) => {
		if (existing_transcript.length === 0) {
			// start speech processing
			return db.audio.get(audId)
			.then((audio) => {
				var transcript = [];
				var emitter = s2t(audId, audio); // share this emitter to partial readers
				emitter.on('data', (word) => {
					db.captions.saveWord(new WordstampSchema({
						"id": audId,
						"word": word.word,
						"start": word.start,
						"end": word.end
					}));
					call.write({
						"word": word.word,
						"start": word.start,
						"end": word.end
					});
				});

				emitter.on('end', () => {
					call.end();
				});

				emitter.on('error', (err) => {
					throw err;
				});
			});
		}
		else {
			existing_transcript.forEach((captionSeg) => {
				call.write({
					"word": captionSeg.word,
					"start": captionSeg.start,
					"end": captionSeg.end
				});
			});
			call.end();
		}
	})
	.catch((err) => {
		grpc.logError(500, err);
		call.end();
	});
};

exports.processAudioSynthesis = (call, callback) => {
	var id = uuidv1();
	var title = id;
	var script = [];

	// format each mixed caption to {id: string, word: string, start: number, end: number}
	call.on('data', (mixedCaptionReq) => {
		script.push(new WordstampSchema({
			"id": mixedCaptionReq.id,
			"word": mixedCaptionReq.content.word,
			"start": mixedCaptionReq.content.start,
			"end": mixedCaptionReq.content.end
		}));
	});
	call.on('end', () => {
		aud.synthesize(script)
		.then((audio) => {
			// save audio to db
			return db.audio.save([new AudioSchema({
				"id": id,
				"source": "SYNTHESIZED",
				"title": title,
				"audio": audio
			})]);
		})
		.then(() => {
			// save captions
			db.captions.saveCaptions(id, script);

			callback(null, {
				"id": id,
				"title": title,
				"source": 'SYNTHESIZED'
			});
		})
		.catch((err) => {
			grpc.logError(500, err);
			callback(null, {
				"id": '',
				"title": '',
				"source": 'UNKNOWN'
			});
		});
	});
};
