#!/usr/bin/env bash

export HEROKU_APP=speech2textservice
heroku container:login
git remote add heroku https://git.heroku.com/$HEROKU_APP.git

docker tag mkaichen/s2t:latest registry.heroku.com/$HEROKU_APP/web
docker push registry.heroku.com/$HEROKU_APP/web
