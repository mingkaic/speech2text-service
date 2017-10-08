// Deps
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');

const reporter = require('node-health-service').Reporter();

const default_port = '8008';
const default_host = '0.0.0.0';

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || default_port;
app.set('port', port);
app.use(reporter.monitor); 

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const routes = require('./routes');
routes.get('/health', reporter.lastError);
app.use(routes);

// Listen on provided port, on all network interfaces.
server.listen(port, default_host, () => {
	console.log(`speech2text API running on localhost:${port}`);
});
