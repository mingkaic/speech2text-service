const SchemaObject = require('schema-object');

module.exports = new SchemaObject({
	"id": String,
	"word": String,
	"start": Number,
	"end": Number,
});
