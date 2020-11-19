const Db = require('./db');
const GEKKO_STATUS = require('./db').GEKKO_STATUS;
const GEKKO_TYPE = require('./db').GEKKO_TYPE;
const BUNDLE_STATUS = require('./db').BUNDLE_STATUS;

let db;

// temp:
const _ = require('lodash');
const log = require('../../core/log.js');
const cache = require('../../web/state/cache');
const base = require('../../web/routes/baseConfig');

const GekkosPersistent = function(){
  db = new Db();
  cache.set('db', db);
  db.create(); //use only to (re)create DB!!

  const gekkoManager = cache.get('gekkos');
  const wss = cache.get('wss');

  wss.on('server_started', async data => {
    try {
      await this.restoreBundlesOnStartup();
    } catch (handleErr){
      consoleError(handleErr);
    }
    try {
      await this.restoreGekkosOnStartup();
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_new', async ({ id, state }) => {
    let newConfig;
    try {
      if (state) {
        let config = state.config;
        if (!state.isProgrammaticCreation) {
          if(!state.gekkoConfig && state.type === GEKKO_TYPE.TRADEBOT && !state.config.bundleUuid) {
            newConfig = await db.addConfig(state);
            if(newConfig && newConfig.id) {
              config.configId = newConfig.id;
            }
          }

          let newGekko = await db.addGekko(state, config);

          // add to account:
          if(newGekko && state.type === GEKKO_TYPE.TRADEBOT && config.apiKeyName) {
            let account = await db.getAccountByApiKeyName(config.apiKeyName);
            if(!account){
              account = await db.createAccount({
                apiKeyName: config.apiKeyName,
                gekkoIds: [ state.id ]
              });
            } else {
              try {
                let res3 = await db.addGekkoToAccount(config.apiKeyName, state.id);
              } catch(err3) {
                consoleError(err3);
              }
            }
          }
        }
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_archived', ({ id }) => {
    try {
      if (id) {
        db.archiveGekko(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_restarted', ({ id, gekko }) => {
    try {
      if (id) {
        db.restartGekko(id, gekko);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_deleted', async ({ id }) => {
    try {
      if(id) {

        const gekko = gekkoManager.archivedGekkos[id] || gekkoManager.gekkos[id];
        const type = gekko.type, apiKeyName = gekko.config.apiKeyName
        db.deleteGekko(id);

        // delete from account:
        if(id && type === GEKKO_TYPE.TRADEBOT && apiKeyName) {
          try {
            let res = await db.removeGekkoFromAccount(apiKeyName, id);
          } catch(err3) {
            consoleError(err3);
          }
        }
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

  // BUNDLES:
  wss.on('bundle_new', async ({ uuid, state }) => {
    let newConfig, existingConfig;
      try {
        if(!state.isProgrammaticCreation) {

          newConfig = await db.addConfig(state, true);

          if (newConfig && newConfig.id) {
            state.configId = newConfig.id;
          }
          try {
            db.addBundle(state);
          } catch (handleErr){
            consoleError(handleErr);
          }
        } else {

        }
      } catch (err1) {
        consoleError(err1);
      }

  });

  /*wss.on('bundle_stopped', ({ id }) => {
    try {
      if (id) {
        db.stopBundle(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });*/
  wss.on('bundle_archived', ({ id }) => {
    try {
      if (id) {
        db.archiveBundle(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('bundle_restarted', ({ id }) => {
    try {
      if (id) {
        db.restartBundle(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  // APIS:
  wss.on('bundle_deleted', async ({ id }) => {
    try {
      if(id) {
        db.deleteBundle(id);
        // db.deleteBundlesGekkos(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('apiKeys', async ({ id }) => {
    try {
      if(id) {
        db.upsertApis(id);
        // db.deleteBundlesGekkos(id);
      }
    } catch (handleErr){
      consoleError(handleErr);
    }
  });
  wss.on('gekko_new', async ({ id, state }) => {
    if(state && state.config && state.config.mode === 'realtime'
      && (state.config.type === 'tradebot' || state.config.type === 'paper trader') && !!state.config.apiKeyName) {
      const uniqueName = state.config.apiKeyName || state.config.trader && state.config.trader.uniqueName;
      if (uniqueName) {
        await db.addGekkoToApi(id, uniqueName);
      }
    }
  });
  wss.on('gekko_archived', async ({ id, state }) => {
    await db.removeGekkoFromApi(id);
  });
  wss.on('gekko_deleted', async ({ id, state }) => {
    await db.removeGekkoFromApi(id);
  });
  // END APIS

  // send to client exapmle
  /*const broadcast = require('../../state/cache').get('broadcast');
  broadcast({
    type: 'gekko_event1',
    id: 1,
    event: {a:2}
  });*/
};

GekkosPersistent.prototype.restoreBundlesOnStartup = async function(){
  const gekkoManager = cache.get('bundles');

  let bundle, config, bundleStarted, res = await db.getAllBundles();
  res.forEach(async r => {
    console.log(r);
    bundle = r && r.dataValues;
    if(bundle) {
      config = await db.getConfigById(bundle.configId);
      if(config) {
        bundleStarted = await startBundleAsync(bundle, config.dataValues, gekkoManager);
      }
    }
  });
}

GekkosPersistent.prototype.restoreGekkosOnStartup = async function(){
  const gekkoManager = cache.get('gekkos');

  const startGekko = startGekkoAsync;
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

GekkosPersistent.prototype.getCustomPerformanceReport = async function({ bundleUuid, apiKeyName, }){ // wip
  let where = {}, ret;
  if(bundleUuid) {
    where['bundleUuid'] = bundleUuid;
  }
  if(apiKeyName) {
    where['apiKeyName'] = apiKeyName;
  }
  const trades = await db.getTrades(where);



  return ret;
}

// CONFIGS:
GekkosPersistent.prototype.saveConfig = async function(state){ // wip
  let newConfig = await db.addConfig(state);
  return newConfig;
}
GekkosPersistent.prototype.getConfigs = async function(options){ // wip
  let ret = await db.getConfigs(options);
  return ret;
}
GekkosPersistent.prototype.deleteConfig = async function({ id, userId }){ // wip
  let ret = await db.deleteConfig({ id, userId});
  return ret;
}


module.exports = GekkosPersistent;

// this is temp, todo: get remove and use main func when it's async
let startGekkoAsync;
startGekkoAsync = async function(gConfig, gekko) {
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

  let state = gekkoManager.add({ config, mode, gekko: gekko.jsonGekko, indicators: gekko.indicators });

  return state;
};
const startBundleAsync = async function(bundle, config, bundleManager) {

  if(!bundle) return;

  const adoptedBundle = {
    isProgrammaticCreation: true,

    active: bundle.status === BUNDLE_STATUS.ACTIVE,
    stopped: bundle.status === BUNDLE_STATUS.STOPPED,

    uuid: bundle.uuid,
    ownerId: bundle.ownerId,

    configId: bundle.configId,
    config: {
      options: config.optionsJson,
      watch: config.watchJson,
      tradingAdvisor: config.tradingAdvisorJson,
    }
  }
  let state = bundleManager.add({ bundle: adoptedBundle });

  return state;
}
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
