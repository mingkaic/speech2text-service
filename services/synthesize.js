const fs = require('fs');
const events = require('events');
const s2Promise = require('stream-to-promise');

const utils = require('../utils');
const audioConv = require('./audioConv');

var vidDb;
var wordDb;
var s2tRequest;
var partition;
if (process.env.NODE_ENV !== 'production') {
	vidDb = require('../../tests/mocks/mockVidDb');
	wordDb = require('../../tests/mocks/mockWordDb');
	s2tRequest = require('../../tests/mocks/mockSpeechApi');
	partition = () => { return null; };
}
else {
	vidDb = require('../database/vidDb');
	wordDb = require('../database/wordDb');
	s2tRequest = require('../api/speechApi');
	partition = audioConv.partition;
}

const chunkDur = 10; // 10 seconds

function removeArrFromB(Arr, B) {
	Arr.forEach((a) => {
		B.delete(a);
	});
}

function getPartitionFunc(start, duration, buffer, progressEmitter) {
	var subtitleRes = [];
	var itFunc = (otherCondition, otherIncrem) => {
		// START OF CONDITIONS
		if (start >= duration || start < 0) {
			start = -1;
			return Promise.resolve({ "subtitles": subtitleRes, "endtime": start });
		}
		// some other condition to end prematurely
		if (otherCondition && otherCondition()) {
			return Promise.resolve({ "subtitles": subtitleRes, "endtime": start });
		}
		// END OF CONDITIONS
		console.log("PERFORMING CHUNK starting: ", start);

		var audioChunkStream = partition(buffer.getStream(), start, Math.min(chunkDur, duration - start));
		return s2tRequest(audioChunkStream)
		.then((response) => {
			var err = response.error;
			if (err) {
				// do something with error
				throw err;
			}

			var subtitles = response.subtitles;
			if (subtitles) {
				if (!(subtitles instanceof Array)) {
					throw "poorly typed subtitles";
				}

				subtitleRes = subtitleRes.concat(subtitles);
				if (otherIncrem) {
					otherIncrem(subtitleRes);
				}
			}

			start += chunkDur; // ITERATE
			
			// report progress
			var progress = start / duration;
			if (progressEmitter) {
				console.log('progress report: ' + progress);
				progressEmitter.emit('progress', progress);
			}

			return itFunc(otherCondition, otherIncrem);
		})
		.then(() => {
			console.log("complete!");
			return { "subtitles": subtitleRes, "endtime": start };
		});
	};
	return itFunc;
}

// check obtain stream and initiate lazy partition starting at time 0
// breaks audio from vidId into chunks, request wordmap from each chunk, 
// stoping once wordSet is fulfilled or stream ends
//		invariants: there needs to be vidId in vidDb to get wordmap otherwise get empty map
// 		warning: wordSet is emptied after lazyPartition
function lazyPartition(vidId, start, wordSet, progressEmitter) {
	return vidDb.getVidStream(vidId)
	.then((audioStream) => {
		console.log("lazy partitioning got audiostream for " + vidId);
		if (null === audioStream || !audioStream.stream) {
			console.log("stream invalid");
			return { "subtitles": [], "endtime": start };
		}

		return audioConv.getDuration(audioStream.stream)
		.then((durOut) => {
			var length = durOut[0];
			var buffer = durOut[1];
			
			// while wordSet is not satisfied and stream is not fulfilled,
			var itFunc = getPartitionFunc(start, length, buffer, progressEmitter);
			return itFunc(() => wordSet.size == 0, 
			(subtitle) => removeArrFromB(subtitle.map(s => s.word), wordSet));
		});
	});
}

// looks at wordMap completion, requesting for missing chunks. (by lazy partitioning starting at last start time)
function fulfill(vidId, start, wordSet, subtitles, progressEmitter) {
	// check completition
	var complete = start < 0;

	// if complete, return wordRes
	if (complete) {
		return Promise.resolve({ "subtitles": subtitles, "endtime": start });
	}
	removeArrFromB(subtitles.map(s => s.word), wordSet);

	console.log("remaining set ", wordSet);

	// else continue request
	return lazyPartition(vidId, start, wordSet, progressEmitter)
	.then((subtitleInfo) => {
		if (subtitleInfo) {
			subtitleInfo.subtitles = subtitles.concat(subtitleInfo.subtitles);
		}
		return subtitleInfo;
	});
}

function getWordMap(vidId, wordSet, progressEmitter) {
	var mapFinder = new Set(wordSet);

	return wordDb.getTranscript(vidId)
	.then((transcriptInst) => {
		var next;
		if (null === transcriptInst) {
			console.log("lazy partitioning " + vidId);

			next = lazyPartition(vidId, 0, wordSet, progressEmitter);
		}
		else {
			console.log("fulfilling " + vidId);
			console.log(transcriptInst);

			var start = transcriptInst.startTime;
			var subtitles = transcriptInst.subtitles;
			// look at wordMap completion, and whether script exists
			next = fulfill(vidId, start, wordSet, subtitles, progressEmitter);
		}

		return next;
	})
	.then((subtitleInfo) => {
		var transcript = subtitleInfo.subtitles;
		var completion = subtitleInfo.endtime;

		console.log("from getWordMap: setting transcript for " + vidId);
		wordDb.setTranscript(vidId, completion, transcript);

		return utils.transcript2Map(transcript, mapFinder);
	});
}

function getScriptMap(vidIds, scriptSet, progressEmitter) {
	var scriptMap = new Map();
	console.log('Looking at vidIds: ' + vidIds);
	return utils.sequentialPromise(vidIds, 
	() => scriptSet.size > 0,
	(vidId) => {
		console.log('EXTRACTING WORD MAP FROM ' + vidId);
		// check which ids have maps on vidDb
		return getWordMap(vidId, scriptSet, progressEmitter)
		.then((wordMap) => {
			if (wordMap) {
				// clone to prevent data reference back to database
				wordMap = utils.obj2Map(JSON.parse(JSON.stringify(utils.map2Obj(wordMap))));
				// label times with id
				for (var keyvalue of wordMap) {
					for (var time of keyvalue[1]) {
						time['id'] = vidId;
					}
				}
	
				// merge word and scriptMap
				utils.addBToA(scriptMap, wordMap);
				
				// remove wordMap from scriptSet
				utils.removeAfromB(wordMap, scriptSet);
			}
		})
		.catch(function (err) {
			// handle: if we can't reach speech to text announce s2t container is down
			console.log(err);
		});
	})
	.then(() => {
		console.log('WORDMAP EXTRACTION COMPLETE');
		return scriptMap;
	});
}

function setAudioTokens(vidId, chunkInfos) {
	// short chunks by start time
	chunkInfos.sort((a, b) => {
		return a.start - b.start;
	});

	return vidDb.getVidStream(vidId)
	.then((streamInfo) => {
		if (streamInfo) {
			audioConv.chunkByTime(streamInfo.stream, chunkInfos);
		}
		else {
			throw 'audio with id ' + vidId + ' not found';
		}
	})
	.catch(console.log);
}

exports.lazyPartition = lazyPartition;

exports.fulfill = fulfill;

exports.getWordMap = getWordMap;

exports.getScriptMap = getScriptMap;

exports.processSubtitles = (vidId, progressEmitter) => {
	return wordDb.getTranscript(vidId)
	.then((transcriptInst) => {
		var start = 0;
		var existing = [];
		if (transcriptInst) {
			start = transcriptInst.startTime;
			existing = transcriptInst.subtitles;
		}
		if (start === -1) {
			return existing;
		}
		return vidDb.getVidStream(vidId)
		.then((audioStream) => {
			console.log("processing subtitles in audiostream for " + vidId);
			if (null === audioStream || !audioStream.stream) {
				console.log("stream invalid");
				return [subtitleRes, start];
			}
	
			return audioConv.getDuration(audioStream.stream);
		})
		.then((durOut) => {
			var length = durOut[0];
			var buffer = durOut[1];
			
			// extract subtitle for everything
			var itFunc = getPartitionFunc(start, length, buffer, progressEmitter);
			return itFunc();
		})
		.then((subtitleInfo) => {
			var subtitles = subtitleInfo.subtitles;
			var completion = subtitleInfo.endtime;
			// assert that completion === -1
			// save to db
			console.log("from processSubtitles: setting transcript for " + vidId);
			wordDb.setTranscript(vidId, completion, subtitles);

			return existing.concat(subtitles);
		})
	})
	.catch((err) => {
		console.log(err);
	});
}

exports.synthesize = (synParam, progressEmitter) => {
	// params must be of form: { "script" : "...", "vidIds" : ["vid1", "vid2", ...] }
	var script = synParam.script;
	var vidIds = synParam.vidIds;
	if (typeof(script) !== "string" || !(vidIds instanceof Array)) {
		throw "bad synthesis parameter: " + JSON.stringify(synParam);
	}

	var tokens = utils.tokenize(script);
	var tokenSet = new Set(tokens);
	if (tokenSet.size === 0) {
		return Promise.resolve({'missing': [], 'stream': null});
	}

	return getScriptMap(vidIds, tokenSet, progressEmitter)
	.then((scriptMap) => {
		// assertion: wordCount is empty, 
		var missingOptions = [];
		var audioMap = new Map();
		tokens = tokens.map((word, index) => {
			var options = scriptMap.get(word);
			if (options) {
				// randomize or search for better fit later
				var chosenOption = options[0];

				// add to audioMap
				var vId = chosenOption.id;
				if (audioMap.has(vId)) {
					audioMap.get(vId).push(chosenOption);
				}
				else {
					audioMap.set(vId, [chosenOption]);
				}
				return chosenOption;
			}
			missingOptions.push(word);
			return null;
		});
		console.log("tokens ", tokens);
		
		console.log('VALIDATING OPTIONS ' + missingOptions);
		// validate layout
		if (missingOptions.length > 0) {
			// todo: add options to accommodate missing audio assets
			// invalid layout
			return { 'missing': missingOptions, 'tokens': null };
		}

		console.log('BEGIN SYNTHESIS');
		var audioPromises = [];
		for (var keyvalue of audioMap) {
			var vId = keyvalue[0];
			var timeInfos = keyvalue[1];
			console.log(timeInfos);
			// extract audio chunks and set it to attribute 'audio'
			audioPromises.push(setAudioTokens(vId, timeInfos));
		}
		return Promise.all(audioPromises)
		.then(() => {
			console.log('END SYNTHESIS');
			return { 'missing': missingOptions, 'tokens': tokens };
		});
	})
	.then((tokenInfo) => {
		var missing = tokenInfo.missing;
		var tokens = tokenInfo.tokens;
		if (null === tokens) {
			return { 'missing': missing, 'stream': null };
		}
		
		console.log("tokens ", tokens);
		var audioLayout = tokens.map((time) => time.audio);
		// assert: every audioLayout eleme is an audioChunk

		// piece together chunks
		console.log('concatenating audios');
		return audioConv.concat(audioLayout)
		.then((synthChunk) => {
			console.log('concatenation successful');
			return { 'missing': missing, 'stream': synthChunk };
		});
	});
};
