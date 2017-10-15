const fs = require('fs');
const stream = require('stream');
const buffer = require("stream-buffer");
const ffmpeg = require('fluent-ffmpeg');
const uuidv1 = require('uuid/v1');

const db = require('../database');

const tempdir = "/tempdir/";

exports.format = (audStream, format) => {  
	return ffmpeg(audioStream).format(format);
};

function chunkate(audio, timestamps) {
    var buffed = audio.pipe(buffer());
    return timestamps.map((stamp) => {
        var startSec = stamp.start + 0.3;
        var durSec = (stamp.end - stamp.start);

        var chunkStrIn = new stream.PassThrough();
		var chunkStrOut = new stream.PassThrough();
		buffed.replay(chunkStrIn);
		chunkStrIn.resume();
        ffmpeg(chunkStrIn).seek(startSec).format('mp3').duration(durSec).pipe(chunkStrOut);
        chunkStrOut.resume();

        return {"index": stamp.index, "audio": chunkStrOut};
    });
}

function glue(audios) {
    if (audios.length < 2) {
        return Promise.resolve(audios[0]);
    }

    var tempid = uuidv1();
    return Promise.all(audios.map((chunk, index) => {
        var fname = __dirname + tempdir + tempid + JSON.stringify(index) + '.mp3';
        var strm = fs.createWriteStream(fname);
        chunk.pipe(strm);
        return new Promise((resolve, reject) => {
            strm.on('error', reject);
            strm.on('close', () => {
                resolve();
            });
        });
    }))
    .then(() => {
        var acc = ffmpeg();
        for (var i = 0; i < audios.length; ++i) {
            var fname = __dirname + tempdir + tempid + JSON.stringify(i) + '.mp3';
            acc.input(fname);
        }
        acc.mergeToFile(__dirname + tempdir + tempid + '.mp3');
        return new Promise((resolve, reject) => {
            acc
            .on('error', reject)
            .on('end', () => {
                resolve();
            });
        });
    })
    .then(() => {
        for (var i = 0; i < audios.length; ++i) {
            var fname = __dirname + tempdir + tempid + JSON.stringify(i) + '.mp3';
            fs.unlink(fname);
        }
        var finalname = __dirname + tempdir + tempid + '.mp3';
        var merged = fs.createReadStream(finalname);
        merged.on('end', () => {
            fs.unlink(finalname);
        });
        return merged;
    })
    .catch((err) => {
        for (var i = 0; i < audios.length; ++i) {
            var fname = __dirname + tempdir + tempid + JSON.stringify(i) + '.mp3';
            if (fs.existsSync(fname)) {
                fs.unlink(fname);
            }
        }
        var finalname = __dirname + tempdir + tempid + '.mp3';
        if (fs.existsSync(finalname)) {
            fs.unlink(finalname);
        }
        throw err; // rethrow
    });
}

exports.synthesize = (script) => {
	// map id to [{ start, end, index }]
	var idseparated = {};
	script.forEach((word, index) => {
		if (!idseparated.hasOwnProperty(word.id)) {
			idseparated[word.id] = [];
		}
		idseparated[word.id].push({
			"start": word.start,
			"end": word.end,
			"index": index
		});
	});

	return Promise.all(Object.keys(idseparated).map((id) => {
        var timestamps = idseparated[id];
		// extract audio streams
		// return Promise.resolve([{"index": number, "audio": stream}...])
		return db.getAudio(id).then((audio) => chunkate(audio, timestamps));
	}))
	.then((audioarrs) => {
		// flatten audioarrs
		var audios = [].concat.apply([], audioarrs);
		// sort by index
		audios.sort((a, b) => a.index - b.index);

		// glue the streams together
		return glue(audios.map((aud) => aud.audio)); // return Promise.resolve(stream);
	});
};
