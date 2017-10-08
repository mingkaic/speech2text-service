const request = require('request-promise');
const utils = require('../utils');

const db = require('../database/vidDb');

const s2tHost = process.env.SPEECH_HOST || '127.0.0.1';
const s2tPort = process.env.SPEECH_PORT || '8000';

const speechURL = process.env.SPEECH_URI || 'http://' + s2tHost + ':' + s2tPort;

const timeout = 100000; // maximum: 1:40 minutes per job

// sphinx4 s2t is resource expensive, 
// so to avoid scaling/overloading the server, we place a queue on each job
var jobQueue = [];

function sphinxCall() {
	if (jobQueue.length === 0) return;
	var cacheInfo = jobQueue[0];
	var cacheId = cacheInfo.id;

	var url = speechURL + '/transcribe/'+cacheId;
	console.log('data cached and calling ' + url);
	cacheInfo.resolve(request.get({
		"url": url,
		"json": true,
		"timeout": timeout
	})
	.then((response) => {
		jobQueue.shift(); // pop first
		sphinxCall();
		if (response) {
			return response;
		}
		else {
			throw "unable to retreive transcript";
		}
	}));
}

module.exports = (audioChunkStream) => {
	return db.cache(audioChunkStream)
	.then((cacheId) => {
		return new Promise((resolve, reject) => {
			jobQueue.push({'id': cacheId, 'resolve': resolve});
			if (jobQueue.length === 1) {
				sphinxCall();
			}
		});
	});
};
