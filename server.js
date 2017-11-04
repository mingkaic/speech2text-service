const grpc = require('shared_grpc');
const routes = require('./routes');

const port = process.env.PORT || '8080';
const service = 's2t';

grpc.buildServer(service, port, {
	"processCaptions": routes.processCaptions,
	"processAudioSynthesis": routes.processAudioSynthesis
});
