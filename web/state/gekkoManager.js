const _ = require('lodash');
const moment = require('moment');

const cache = require('./cache');
const broadcast = require('./cache').get('broadcast');
let dependenciesManager = require('./cache').get('dependencies');

const Logger = require('./logger');
const pipelineRunner = require('../../core/workers/pipeline/parent');
const reduceState = require('./reduceState.js');
const now = () => moment().format('YYYY-MM-DD HH:mm');

const GekkoManager = function() {
  this.gekkos = {};
  this.instances = {};
  this.loggers = {};

  this.archivedGekkos = {};
}

GekkoManager.prototype.add = function({mode, config, gekko, indicators}) {
  // set type
  let type;
  if(mode === 'realtime') {
    if(config.market && config.market.type)
      type = config.market.type;
    else
      type = 'watcher';
  } else {
    type = '';
  }

  let logType = type;
  if(logType === 'leech') {
    if(config.trader && config.trader.enabled)
      logType = 'tradebot';
    else
      logType = 'papertrader';
  }

  const date = now().replace(' ', '-').replace(':', '-');
  const n = (Math.random() + '').slice(3);
  let id = `${date}-${logType}-${n}`;
  let state;
  id = gekko && gekko.id || id;

  if(gekko && gekko.type !== 'watcher') {
    // load indicators:
    config.indicators = indicators || {};
    // restoring existing gekko from db:
    config.childToParent.enabled = true;
    state = {
      mode: gekko.mode || mode,
      config,
      id,
      type: gekko.type || type,
      logType: gekko.logType || logType,
      active: !_.isUndefined(gekko.active) ? gekko.active : true,
      stopped: !_.isUndefined(gekko.stopped) ? gekko.stopped : false,
      errored: !_.isUndefined(gekko.errored) ? gekko.errored : false,
      errorMessage: !_.isUndefined(gekko.errorMessage) ? gekko.errorMessage : false,
      events: gekko.events || {
        initial: {},
        latest: {}
      },
      start: moment(),
    }
  } else {

    // make sure we catch events happening inside te gekko instance
    config.childToParent.enabled = true;
    state = {
      mode,
      config,
      id,
      type,
      logType,
      active: true,
      stopped: false,
      errored: false,
      errorMessage: false,
      events: {
        initial: {},
        latest: {}
      },
      start: moment(),
    }

  }
  if(!!gekko){
    state.isProgrammaticCreation = true;
  }
  config.gekkoId = id;

  if(type === 'watcher') {
    state.events.initial = {};
    state.events.latest = {};
  }
  let usr = cache.get('user');
  state.ownerId = gekko && gekko.ownerId || cache.get('user') && cache.get('user').get('id');
  this.gekkos[id] = state;

  this.loggers[id] = new Logger(id);

  // start the actual instance
  this.instances[id] = pipelineRunner(mode, config, this.handleRawEvent(id));

  // after passing API credentials to the actual instance we mask them
  if(logType === 'trader') {
    config.trader.key = '[REDACTED]';
    config.trader.secret = '[REDACTED]';
  }

  console.log(`${now()} Gekko ${id} started.`);

  broadcast({
    type: 'gekko_new',
    id,
    state
  });
  if(!dependenciesManager){
    dependenciesManager = require('./cache').get('dependencies'); // circular reference problem
  }
  return state;
}

GekkoManager.prototype.handleRawEvent = function(id) {
  const logger = this.loggers[id];

  return (err, event) => {
    if(err) {
      return this.handleFatalError(id, err);
    }

    if(!event) {
      return;
    }

    if(event.log) {
      return logger.write(event.message);
    }

    if(event.type) {
      this.handleGekkoEvent(id, event);
    }
  }
}

GekkoManager.prototype.handleGekkoEvent = function(id, event) {
  this.gekkos[id] = reduceState(this.gekkos[id], event);
  broadcast({
    type: 'gekko_event',
    id,
    event
  });
}

GekkoManager.prototype.handleFatalError = function(id, err) {
  const state = this.gekkos[id];

  if(!state || state.errored || state.stopped)
    return;

  state.errored = true;
  state.errorMessage = err;
  console.error('RECEIVED ERROR IN GEKKO INSTANCE', id);
  console.error(err);
  broadcast({
    type: 'gekko_error',
    id,
    error: err
  });

  this.archive(id);

  if(state.logType === 'watcher') {
    this.handleWatcherError(state, id);
  }
}

// There might be leechers depending on this watcher, if so
// figure out it we can safely start a new watcher without
// the leechers noticing.
GekkoManager.prototype.handleWatcherError = function(state, id) {
  let watch1, watch2;
  console.log(`${now()} A gekko watcher crashed.`);
  if(!state.events.latest.candle) {
    console.log(`${now()} was unable to start.`);
  }

  let latestCandleTime = moment.unix(0);
  if(state.events.latest && state.events.latest.candle) {
    latestCandleTime = state.events.latest.candle.start;
  }
  watch1 = state.config.watch;
  const leechers = _.values(this.gekkos)
    .filter(gekko => {
      if(gekko.type !== 'leech') {
        return false;
      }
      watch2 = gekko.config.watch;
      return !!(watch1 && watch2
        && watch1.asset === watch2.asset && watch1.currency === watch2.currency && watch1.exchange === watch2.exchange);
    });

  if(leechers.length) {
    console.log(`${now()} ${leechers.length} leecher(s) were depending on this watcher.`);
    if(moment().diff(latestCandleTime, 'm') < 60) {
      console.log(`${now()} Watcher had recent data, starting a new one in a minute.`);
      // after a minute try to start a new one again..
      setTimeout(() => {
        const mode = 'realtime';
        const config = state.config;
        this.add({mode, config});
      }, 1000 * 60);
    } else {
      console.log(`${now()} Watcher did not have recent data, killing its leechers.`);
      leechers.forEach(leecher => this.stop(leecher.id));
    }

  }
}

GekkoManager.prototype.stop = function(id) {
  if(!this.gekkos[id])
    return false;

  console.log(`${now()} stopping Gekko ${id}`);

  this.gekkos[id].stopped = true;
  this.gekkos[id].active = false;

  // todo: graceful shutdown (via gekkoStream's
  // finish function).
  this.instances[id].kill();

  broadcast({
    type: 'gekko_stopped',
    id
  });

  this.archive(id);

  return true;
}

GekkoManager.prototype.archive = function(id) {
  this.archivedGekkos[id] = this.gekkos[id];
  this.archivedGekkos[id].stopped = true;
  this.archivedGekkos[id].active = false;
  delete this.gekkos[id];

  broadcast({
    type: 'gekko_archived',
    id
  });
}

GekkoManager.prototype.delete = function(id) {
  if(this.gekkos[id]) {
    throw new Error('Cannot delete a running Gekko, stop it first.');
  }

  if(!this.archivedGekkos[id]) {
    throw new Error('Cannot delete unknown Gekko.');
  }

  console.log(`${now()} deleting Gekko ${id}`);

  broadcast({
    type: 'gekko_deleted',
    id
  });

  delete this.archivedGekkos[id];

  return true;
}

GekkoManager.prototype.archive = function(id) {
  this.archivedGekkos[id] = this.gekkos[id];
  this.archivedGekkos[id].stopped = true;
  this.archivedGekkos[id].active = false;
  delete this.gekkos[id];

  broadcast({
    type: 'gekko_archived',
    id
  });
}

GekkoManager.prototype.restart = function({ id }) {
  let gekko = this.gekkos[id] || this.archivedGekkos[id];
  const user = cache.get('user');
  if(!gekko || !user)
    return false;

  console.log(`${now()} restarting Gekko ${id}`);


  delete this.gekkos[id];
  delete this.archivedGekkos[id];
  // this.instances[id] && this.instances[id].kill();

  gekko.active = true;
  gekko.stopped = false;
  gekko.errored = false;
  gekko.errorMessage = false;

  this.add({ mode: gekko.mode, config: gekko.config, gekko: gekko });

  broadcast({
    type: 'gekko_restarted',
    id,
    gekko
  });

  // this.archive(id);

  return true;
}

GekkoManager.prototype.list = function() {
  return { live: this.gekkos, archive: this.archivedGekkos };
}

GekkoManager.prototype.command = function(id, command) {
  let ret = { success: false, payload: {}}, gekkoProcess = this.instances[id];
  if(gekkoProcess && !gekkoProcess.killed && !!gekkoProcess.connected && gekkoProcess.exitCode !== 1) {
    try {
      const ret1 = gekkoProcess.send({
        event: 'command1',
        type: 'command1',
        payload: {
          command, id
        },
      });
      ret.success = true;
      ret.payload = ret1;
    } catch (e) {
      console.error('GekkoManager.prototype.command::thrown exception: ', e);
      ret.success = false;
      ret.reason = 'thrown exception';
      ret.payload = e;
    }
  } else {
    console.error('GekkoManager.prototype.command::process is not running: ', JSON.stringify(gekkoProcess));
    ret.success = false;
    ret.reason = 'process is not running (probably this Gekko died)';
    ret.payload = gekkoProcess;
  }
  return ret;
}

module.exports = GekkoManager;
