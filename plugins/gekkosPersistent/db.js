const _ = require('lodash');
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../core/log.js');
const util = require('../../core/util.js');

let sequelize, config
  , GekkosTable, ConfigsTable, BundlesTable, AccountsTable;
const GEKKO_TYPE = {
  WATCHER: 'watcher',
  TRADEBOT: 'leech'
}

const GEKKO_STATUS = {
  ACTIVE: 'active',
  STOPPED: 'stopped',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
}
const BUNDLE_STATUS = {
  ACTIVE: 'ACTIVE',
  STOPPED: 'STOPPED',
  ARCHIVED: 'ARCHIVED'
}
const Db = function(settings = {}){
  config = util.getConfig();
  let connectionString = config.postgresql.connectionString + '/' + config.postgresql.database;
  sequelize = new Sequelize(connectionString, {
    pool: {
      max: 30,
      min: 0,
      idle: 10000
    }
  });
  GekkosTable = sequelize.import('./models/gekko.js');
  ConfigsTable = sequelize.import('./models/configs.js');
  BundlesTable = sequelize.import('./models/bundles.js');
  AccountsTable = sequelize.import('./models/accounts.js');
}

Db.prototype.create = async function() {
  // create all tables:
  try {
    await require('./models/gekko').create(GekkosTable)
  } catch (e) {
    consoleError('table "GekkosTable" not created: ', e);
  }
  try {
    await require('./models/configs').create(ConfigsTable);
  } catch (e) {
    consoleError('table "ConfigsTable" not created: ', e);
  }
  try {
    await require('./models/bundles').create(BundlesTable)
  } catch (e) {
    consoleError('table "BundlesTable" not created: ', e);
  }
  try {
    await require('./models/accounts').create(AccountsTable)
  } catch (e) {
    consoleError('table "AccountsTable" not created: ', e);
  }
}
// GEKKOS:
Db.prototype.addGekko = async function(gekko){
  let exists = false, newGekko;
  const config = gekko.config;
  const options = config && config.options || {};
  if(gekko && gekko.config) {
    if (gekko.type === GEKKO_TYPE.WATCHER) {
      exists = await this.isExistingMarketWatcher(config.watch);
    }

    if (!exists) {
      try {
        newGekko = await GekkosTable.create({
          name: options.name || null,
          description: options.description || null,
          sendNotifications: gekko.type === GEKKO_TYPE.WATCHER? null: _.isUndefined(options.sendNotifications)? false: options.sendNotifications,
          ownerId: gekko.ownerId,
          status: gekko.active ? GEKKO_STATUS.ACTIVE : gekko.stopped ? GEKKO_STATUS.STOPPED : null,

          bundleUuid: config.bundleUuid,
          gekkoId: gekko.id,
          configId: config.configId || null,
          type: gekko.type,
          mode: gekko.mode,
          jsonGekko: gekko,

          exchange: config.watch.exchange,
          currency: config.watch.currency,
          asset: config.watch.asset,
        });
      } catch (err1) {
        consoleError(err1);
      }
    }
  }
  return newGekko;
}
Db.prototype.restartGekko = async function(id, gekko){
  let result;
  try {
    if(id) {
      result = await GekkosTable.update({
        jsonGekko: gekko,
        status: GEKKO_STATUS.ACTIVE
      }, {
        where: {
          gekkoId: id
        }
      });
    }
  } catch (err1) {
    consoleError(err1);
  }
  return result;
}
Db.prototype.updateJsonGekko = async function(id, gekko){
  let result;
  try {
    if(id) {
      result = await GekkosTable.update({
        jsonGekko: gekko,
      }, {
        where: {
          gekkoId: id
        }
      });
    }
  } catch (err1) {
    consoleError(err1);
  }
  return result;
}
Db.prototype.archiveGekko = async function(id){
  let result;
  const gekkoDb = await GekkosTable.findOne({
    where: {
      gekkoId: id
    }
  });
  try {
    if(gekkoDb) {
      let jsonGekko = gekkoDb.getDataValue('jsonGekko');
      if(jsonGekko) {
        jsonGekko.active = false;
        jsonGekko.stopped = true;
        result = await GekkosTable.update({
          jsonGekko: jsonGekko,
          status: GEKKO_STATUS.ARCHIVED
        }, {
          where: {
            gekkoId: id
          }
        });
      }
    }
  } catch (err1) {
    consoleError(err1);
  }
  return result;
}
Db.prototype.deleteGekko = async function(id){
  let result;
  try {
    result = await GekkosTable.destroy({
      where: {
        gekkoId: id
      }
    });
  } catch (err1) {
    consoleError(err1);
  }
  return result;
}
Db.prototype.getAllGekkos = async function(includeDeleted) {
  let where;
  if(includeDeleted){
    where = {}
  } else {
    where = {
      status: {
        [Op.ne]: GEKKO_STATUS.DELETED
      }
    }
  }
  const ret = await GekkosTable.findAll({
    where
  });
  return ret;
}
Db.prototype.isExistingMarketWatcher = async function(watch) {
  watch = watch || {}
  let res = await GekkosTable.findAll({
      where: {
        type: GEKKO_TYPE.WATCHER,
        exchange: watch.exchange,
        currency: watch.currency,
        asset: watch.asset
      }
    });
  return !!res.length;
}

// CONFIGS:
Db.prototype.addConfig = async function(state = {}, isBundle){
  let ret; // todo
  const config = state.config || {}, options = config.options || {};
  if(_.isUndefined(isBundle)) {
    isBundle =  config.bundleUuid ? true : false;
  }
  if(state && state.config) {
    if (config.tradingAdvisor && config.tradingAdvisor.method) {
      try {
        ret = await ConfigsTable.create({
          name: options.name,
          description: options.description,
          ownerId: state.ownerId,

          gekkoId: !isBundle ? state.id : null,
          bundleId: isBundle? state.id : null,
          exchange: config.watch.exchange,
          currency: config.watch.currency,
          assets: !isBundle ? [ config.watch.asset ]: config.watch.assets,
          strategy: config.tradingAdvisor.method,

          paramsJson: config[config.tradingAdvisor.method],
          configJson: config, // ?? do need?

          optionsJson: options,
          watchJson: config.watch,
          tradingAdvisorJson: config.tradingAdvisor,

          isBundle
        });
      } catch (err1) {
        consoleError(err1);
      }
    }
  }
  return ret;
}

Db.prototype.getConfigById = async function(id) {
  let where = {
    id
  }
  const ret = await ConfigsTable.findOne({
    where
  });
  return ret;
}

// BUNDLES:
Db.prototype.getAllBundles = async function() {
  let where = {}
  const ret = await BundlesTable.findAll({
    where
  });
  return ret;
}
Db.prototype.addBundle = async function(bundle) {
  let newBundle;
  if(!bundle) throw 'now bundle provided'
  const options = bundle.options || {};
  if(bundle) {
    try {
      newBundle = await BundlesTable.create({
        name: options.name || null,
        description: options.description || null,
        sendNotifications: _.isUndefined(options.sendNotifications)? false: options.sendNotifications,
        ownerId: bundle.ownerId,
        status: bundle.active ? BUNDLE_STATUS.ACTIVE : bundle.stopped ? BUNDLE_STATUS.STOPPED : null,

        uuid: bundle.uuid,
        configId: bundle.configId
      });
    } catch (err1) {
      consoleError(err1);
    }
  }
  return newBundle;
}
Db.prototype.stopBundle = async function(id) {
  return await BundlesTable.update({
    status: BUNDLE_STATUS.STOPPED
  }, {
    where: {
      uuid: id
    }
  });
}
Db.prototype.archiveBundle = async function(id) {
  return await BundlesTable.update({
    status: BUNDLE_STATUS.ARCHIVED
  }, {
    where: {
      uuid: id
    }
  });
}
Db.prototype.restartBundle = async function(id) {
  return await BundlesTable.update({
    status: BUNDLE_STATUS.ACTIVE
  }, {
    where: {
      uuid: id
    }
  });
}
Db.prototype.deleteBundle = async function(id) {
  return await BundlesTable.destroy({
    where: {
      uuid: id
    }
  });
}

// ACCOUNTS: (exchanges accounts, identified by ApiKey)
Db.prototype.getAccountByApiKeyName = async function(apiKeyName) {
  const ret = await AccountsTable.findOne({
    where: {
      apiKeyName
    }
  });
  return ret;
}
Db.prototype.createAccount = async function(account) {
  if(!account) {
    throw 'account is not provided';
  }
  let ret;
  ret = await AccountsTable.create(account);
  return ret;
}
Db.prototype.addGekkoToAccount = async function(apiKeyName, gekkoId) {
  if(!apiKeyName || !gekkoId) {
    throw 'relevant data is not provided';
  }
  let ret;
  ret = await AccountsTable.update({
    gekkoIds: sequelize.fn('array_append', sequelize.col('gekkoIds'), gekkoId) // see https://www.postgresql.org/docs/9.1/functions-array.html
  }, {
    where: {
      apiKeyName
    }
  });
  return ret;
}
Db.prototype.removeGekkoFromAccount = async function(apiKeyName, gekkoId) {
  if(!apiKeyName || !gekkoId) {
    throw 'relevant data is not provided';
  }
  let ret;
  ret = await AccountsTable.update({
    gekkoIds: sequelize.fn('array_remove', sequelize.col('gekkoIds'), gekkoId) // see https://www.postgresql.org/docs/9.3/functions-array.html
  }, {
    where: {
      apiKeyName
    }
  });
  return ret;
}
Db.prototype.portfolioChangeForAccount = async function(portfolio, config) {
  if(!portfolio || !config || !config.apiKeyName) {
    return 'not all data provided';
  }
  let res, options = {}, where = {
    apiKeyName: config.apiKeyName
  }
  let account = await AccountsTable.findOne({
    where
  });
  if(!account) {
    options = {

      apiKeyName: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      ownerId: Sequelize.INTEGER,
      watchers: Sequelize.ARRAY(Sequelize.JSON),
    }
    account = await this.createAccount(options);
  }
  const balances = account.balances, pair1name = config.watch.asset, pair1balance = portfolio.asset,
    pair2name = config.watch.currency, pair2balance = portfolio.currency;
  balances[ pair1name ] = pair1balance;
  balances[ pair2name ] = pair2balance;

  res = await AccountsTable.update({
    balances
  }, {
    where
  });
  return res;
}

module.exports = Db;
module.exports.GEKKO_TYPE = GEKKO_TYPE;
module.exports.GEKKO_STATUS = GEKKO_STATUS;
module.exports.BUNDLE_STATUS = BUNDLE_STATUS;

const consoleError = function(msg, obj) {
  console.error(msg, obj);
  log.info('GekkosPersistent DB error:', msg, obj);
}

