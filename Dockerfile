FROM mkaichen/node-ubuntu

ENV S2T_DIR /usr/src/s2t

# Create app directory
RUN mkdir -p $S2T_DIR
WORKDIR $S2T_DIR

# move everything
COPY . $S2T_DIR

EXPOSE 8008

# everything
RUN bash setup.sh

CMD [ "npm", "start" ]
