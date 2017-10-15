#!/usr/bin/env bash
set -e

git clone https://github.com/mingkaic/shared_mongodb_api.git database
apt-get update && apt-get install -y ffmpeg
npm install

# npm install -g node-gyp
# pushd addon && npm i && popd
