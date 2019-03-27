FROM node:8

ENV HOST localhost
ENV PORT 3000

# Update
RUN apt-get update && \
    apt-get install git nano

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app 

# Install GYP dependencies globally, will be used to code build other dependencies
RUN npm install -g --production node-gyp && \
    npm cache clean --force

# Install Gekko dependencies
COPY package.json .
RUN npm install --production && \
    npm install --production redis@0.10.0 talib tulind pg convnetjs mathjs && \
    npm cache clean --force

# Install Gekko Broker dependencies
WORKDIR exchange
COPY exchange/package.json .
RUN npm install --production && \
    npm cache clean --force
WORKDIR ../

# Install cpanminus.
RUN curl -L http://cpanmin.us | perl - App::cpanminus

# Install perl dependencies for Gekko-BacktestTool.
RUN cpanm -n install Parallel::ForkManager Time::Elapsed Getopt::Long List::MoreUtils File::chdir Statistics::Basic DBI DBD::SQLite JSON::XS TOML File::Basename File::Find::Wanted Template LWP::UserAgent LWP::Protocol::https Set::CrossProduct DBD::CSV Text::Table File::Copy

# Bundle app source
COPY . /usr/src/app

# Update Gekko strategies
WORKDIR ./Gekko-Strategies
RUN git pull --no-edit https://github.com/xFFFFF/Gekko-Strategies
RUN bash ./install.sh /usr/src/app
WORKDIR ../

# Update Gekko BacktestTool
WORKDIR ./Gekko-BacktestTool
RUN git pull --no-edit https://github.com/xFFFFF/Gekko-BacktestTool.git
WORKDIR ../

EXPOSE 3000
RUN chmod +x /usr/src/app/docker-entrypoint.sh
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]

CMD ["--config", "config.js", "--ui"]
