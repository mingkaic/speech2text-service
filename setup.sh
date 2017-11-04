#!/usr/bin/env bash
set -e

apt-get update && apt-get install -y ffmpeg
npm install

# npm install -g node-gyp
# pushd addon && npm i && popd
