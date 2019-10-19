const Db = require('./db');
const GEKKO_STATUS = require('./db').GEKKO_STATUS;
let db;

// temp:
const _ = require('lodash');
const log = require('../../../core/log.js');
const cache = require('../../state/cache');
const base = require('../../routes/baseConfig');

const GekkosPersistent = function(){
  db = new Db();
  const gekkoManager = cache.get('gekkos');

  const wss = require('../../state/cache').get('wss');

  wss.on('server_started', data => {
    try {
      this.restoreGekkosOnStartup();
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_new', ({ id, state }) => {
    try {
      if (state) {
        let config = state.config;
        if (!state.isProgrammaticCreation) {
          db.addGekko(state, config)
        }
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_archived', ({ id }) => {
    try {
      if (id) {
        const gekko = getGekkoObjectFromManager(id);
        if (!gekko.isProgrammaticCreation) {
          db.archive(id);
        }
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_deleted', ({ id }) => {
    try {
      if(id) {
        db.delete(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_error', ({ id }) => {
    try {
      if(id) {
        const gekko = getGekkoObjectFromManager(id);
        gekko && db.updateJsonGekko(id, gekko);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_event', ({ id, event }) => {
    try {
      const WHITE_LISTED_EVENTS = [
        'tradeInitiated', 'portfolioChange', 'portfolioValueChange', 'tradeCompleted'
        , 'performanceReport', 'roundtrip'
      ];
      if (WHITE_LISTED_EVENTS.indexOf(event.type) !== -1) {
        consoleLog(`gekko_event: ${event.type}, id: ${ id }`);

        const gekko = gekkoManager.gekkos[id];
        gekko && db.updateJsonGekko(id, gekko);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_restarted', ({ id, event }) => {
    try {
      const gekko = gekkoManager.gekkos[id];
      gekko && db.updateJsonGekko(id, gekko);
    } catch (handleErr){
      consoleError(handleErr);
    }
  });

  // send to client expml
  /*const broadcast = require('../../state/cache').get('broadcast');
  broadcast({
    type: 'gekko_event1',
    id: 1,
    event: {a:2}
  });*/
};

GekkosPersistent.prototype.restoreGekkosOnStartup = async function(){
  const gekkoManager = cache.get('gekkos');

  const startGekko = startGekkoSync;
  let res = await db.getAllGekkos();
  res.forEach(async r => {
    let gekko = r && r.dataValues;
    if(gekko && gekko.jsonGekko) {
      gekko.jsonGekko.isProgrammaticCreation = true;
      gekko.jsonGekko.gekkoId = gekko.gekkoId;
      gekko.jsonGekko.ownerId = gekko.ownerId;
      let gConfig = gekko.jsonGekko.config;
      if(!gConfig) {
        consoleError(`gekkosPersistent plugin error: no config on ${ gekko.gekkoId }`);
      } else {
        await startGekko(gConfig, gekko);
        if(gekko.status === GEKKO_STATUS.ARCHIVED){
          gekkoManager.stop(gekko.gekkoId);
        }
      }
    }
  });
}

module.exports = GekkosPersistent;

// this is temp, todo: get remove and use main func when it's async
let startGekkoSync;
startGekkoSync = async function(gConfig, gekko) {
  const apiKeyManager = cache.get('apiKeyManager');
  const gekkoManager = cache.get('gekkos');

  const mode = gConfig.mode;

  let config = {};

  _.merge(config, base, gConfig);

  // Attach API keys
  if (config.trader && config.trader.enabled && !config.trader.key) {

    const keys = apiKeyManager._getApiKeyPair(config.watch.exchange);

    if (!keys) {
      throw 'No API keys found for this exchange.';
      return;
    }

    _.merge(
      config.trader,
      keys,
    );
  }

  let state = gekkoManager.add({ config, mode, gekko: gekko.jsonGekko });

  return state;
};
function getGekkoObjectFromManager(id) {
  let ret;
  const gekkoManager = cache.get('gekkos');
  ret = gekkoManager.gekkos[ id ] || gekkoManager.archivedGekkos[ id ];
  return ret;
}
function consoleError(msg){
  console.error(msg);
  log.info(msg);
}
function consoleLog(msg){
  console.log(msg);
  log.info(msg);
}
