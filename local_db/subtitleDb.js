const sharedDb = require('../database');
const uas = require('../services/uas');

var scriptModel = require('./_models/subtitle_model');
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
	var localSrc;
	return sharedDb.audioQuery({ "id": id })
	.then((metas) => {
		localSrc = metas[0].source;
		if ("synthesized" === localSrc) {
			return exports.getScript(id);
		}
		return wordModel.find({ "id": id }).exec();
	})
	.then((transcript) => {
		// youtube source name is dependent on uas schema (todo: revise)
		if (0 === transcript.length && ".youtube" === localSrc) {
			// look at uas
			return new Promise((resolve) => {
				uas.get_transcript(id)
				.then((transcript) => {
					// save transcript
					transcript.forEach((word) => exports.setWord(word));
					resolve(transcript);
				})
				.catch((err) => {
					// if transcript is not found (not supported by youtube)
					resolve([]); // resolve anyways
				});
			});
		}
		return transcript.sort((a, b) => a.start - b.start);
	});
};

exports.setScript = (id, script) => {
	return Promise.all(script.map((word) => {
		return wordModel.findOne({
			"id": word.id,
			"word": word.word,
			"start": word.start,
			"end": word.end,
		}).exec();
	}))
	.then((wordInfos) => {
		if (!wordInfos.every((info) => null !== info)) {
			throw "word script not found";
		}
		
		return new scriptModel({
			"id": id,
			"script": wordInfos.map((info) => info._id)
		}).save();
	})
};

exports.getScript = (id) => {
	return scriptModel.findOne({"id": id}).exec()
	.then((info) => {
		if (info) {
			return wordModel.find({
				"_id": { $in: info.script }
			}).exec();
		}
		return info;
	});
};
