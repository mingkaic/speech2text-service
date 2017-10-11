const request = require('request-promise');
const uasURL = process.env.UAS_URL || 'http://127.0.0.1:3124';

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
            resolve(response);
        })
        .catch((err) => {
            // transcript not found, or service down
            resolve(null);
        });
    });
};
