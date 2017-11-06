require('dotenv').load();
const fs = require('fs');
const chai = require('chai');
const clean = require('mongo-clean');
const db = require('shared_mongodb_api');
const grpc = require('shared_grpc');

const client = grpc.s2t_cli;
const schemas = grpc.schemas;
const audDb = db.audio;
const audSchema = db.AudioSchema;
const mongoURL = db.Connection.url;

const expect = chai.expect; // we are using the "expect" style of Chai

const UPLOADED_id = "uploaded_id";

var testStream = fs.createReadStream(__dirname + '/data/test.mp3');

describe("S2T GRPC Route", function() {
    before(function(done) {
        require('../server');
        audDb.save([
            new audSchema({
                "id": UPLOADED_id,
                "source": 'UPLOADED',
                "title": 'uploadedtitle',
                "audio": testStream
            })
        ], () => {}, done);
    });

    it('processCaptions should return expected captions', 
    function(done) {
		client.processCaptions(new schemas.AudioRequest({
			"id": UPLOADED_id
		}))
		.then((captions) => {
            expect(captions.length).to.equal(3);
            expect(captions[0].word).to.equal('apple');
            expect(captions[1].word).to.equal('apple');
            expect(captions[2].word).to.equal('apple');
			done();
		})
		.catch(done);
	});
    
    it('processAudioSynthesis should return metadata for synthesized audio', 
    function(done) {
        var appleword = 
        new schemas.MixedCaptionRequest({
            "id": UPLOADED_id,
            "word": "apple",
            "start": 3,
            "end": 4
        });
        client.processAudioSynthesis([ appleword, appleword ])
        .then((synthAudio) => {
			expect(synthAudio.id).to.equal(synthAudio.title);
			expect(synthAudio.source).to.equal('SYNTHESIZED');
            done();
        })
        .catch(done);
    });
	
	after(function(done) {
		clean(mongoURL, function (err, db) {
			done();
		});
	});
});
