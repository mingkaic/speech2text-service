const request = require('request-promise');
const WordSchema = require('../local_db/_schemas/wordstamp_schema');

const uasHost = process.env.UAS_HOST || '127.0.0.1';
const uasPort = process.env.UAS_PORT || 8080;
const uasURL = process.env.UAS_URL || 'http:' + uasHost + ':' + uasPort;

// required to diminish load on s2t and train s2t
exports.get_transcript = (id) => {
    return new Promise((resolve) => {
        request({
            "encoding": 'utf8',
            "method": 'GET',
            "uri": uasURL + '/caption/' + id,
            "json": true
        })
        .then((response) => {
            resolve(response.map((word => {
                word["id"] = id;
                return new WordSchema(word);
            })));
        })
        .catch((err) => {
            // transcript not found, or service down
            resolve(null);
        });
    });
};
