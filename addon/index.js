const fs = require("fs");
const path = require("path");
const worker = require("streaming-worker");

const addon_path = path.join(__dirname, "build/Release/addon");
const addon = worker(addon_path);

const readstr = fs.createReadStream("test.mp3");

var termination = () => { addon.to.emit("end"); };
const input = addon.to.stream("audio", termination);

readstr.pipe(input);

addon.from.on('concat', (value) => {
    console.log("String of stream:", value);
});
