const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const buffer = require("stream-buffer");
const uuidv1 = require('uuid/v1');

const tempPath = __dirname + "/../temp/";
const offset = 0.5;

// untested
exports.format = (audioStream, format) => {
	return ffmpeg(audioStream).format(format);
};

exports.partition = (audioBuffer, start, duration) => {
	return ffmpeg(audioBuffer)
	.seekInput(start-offset)
	.format('wav')
	.duration(duration+offset)
	.on('error', (err) => {
		console.log(err);
	});
};

// untested
exports.chunkByTime = (audioStream, times) => {
	if (!(times instanceof Array)) {
		times = [times];
	}
	var buffed = audioStream.pipe(buffer());

	times.forEach((time) => {
		var startSec = time.start / 1000;
		var durSec = (time.end - time.start) / 1000;

		var chunkStrIn = new stream.PassThrough();
		var chunkStrOut = new stream.PassThrough();
		buffed.replay(chunkStrIn);
		chunkStrIn.resume();
		ffmpeg(chunkStrIn).seek(startSec).format('mp3').duration(durSec).pipe(chunkStrOut);
		chunkStrOut.resume();

		time['audio'] = chunkStrOut;
	});
};

exports.concat = (chunks) => {
	var uuid = uuidv1();
	var tempfile = tempPath + uuid;

	var audStream = ffmpeg();
	var fnames = [];
	chunks.forEach((chunk, idx) => {
		var fname = tempfile + JSON.stringify(idx) + ".mp3";
		console.log('in concat: writing to file ' + fname);
		var ws = fs.createWriteStream(fname);
		audStream.input(fname);
		fnames.push(fname);

		chunk.pipe(ws);
		ws.once('close', () => {
			if (chunks.every(c => c._readableState.ended)) {
				console.log('all chunks end');
				audStream.mergeToFile(tempfile + ".mp3");
			}
		});
	});

	return new Promise((resolve, reject) => {
		audStream.on('end', () => {
			fnames.forEach((fname) => {
				console.log('in concat: unlinking file ' + fname);
				fs.unlink(fname);
			});
			var outStream = fs.createReadStream(tempfile + ".mp3");
			outStream.once('close', () => {
				fs.unlink(tempfile + '.mp3');
			});
			resolve(outStream);
		});
	});
};

// todo: improve to prevent actually reading to file before duration
exports.getDuration = (audioStream) => {
	var uuid = uuidv1();
	var buffed = audioStream.pipe(buffer());
	buffed.getStream = () => {
		var pass = new stream.PassThrough();
		buffed.replay(pass);
		pass.resume();
		return pass;
	}
	var ws = fs.createWriteStream(tempPath + uuid + ".mp3");
	ffmpeg(buffed.getStream())
	.format('mp3')
	.pipe(ws)
	.on('error', (err) => {
		console.log(err);
	});

	return new Promise((resolve, reject) => {
		console.log('promising to get duration');
		ws.on('finish', () => {
			console.log('evaluating mp3 duration');
			ffmpeg.ffprobe(tempPath + uuid + ".mp3", (err, metadata) => {
				var duration = metadata.format.duration;
				if (err) {
					reject(err);
				}
				else {
					resolve([duration, buffed]);
				}
				fs.unlink(tempPath + uuid + ".mp3");
			});
		})
		.on('error', (err) => {
			reject(err);
		});
	});
};
