const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, GekkosTable;

module.exports = function(sequelize, DataTypes) {

  GekkosTable = sequelize.define('Gekkos', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    gekkoId: {
      type: Sequelize.STRING(100),
      allowNull: false
    },
    bundleId: Sequelize.INTEGER,
    bundleUuid: Sequelize.UUID,
    name: {
      type: Sequelize.STRING(100),
      defaultValue: Sequelize.UUIDV4,
    },
    description: {
      type: Sequelize.STRING(1000),
    },
    sendNotifications: Sequelize.BOOLEAN,
    ownerId: Sequelize.INTEGER,
    configId: Sequelize.INTEGER,
    status: Sequelize.STRING(10),
    type: Sequelize.STRING(20),
    mode: Sequelize.STRING(20),
    jsonGekko: Sequelize.JSON,
    indicators: Sequelize.JSON,

    exchange: Sequelize.STRING(30),
    currency: Sequelize.STRING(10),
    asset: Sequelize.STRING(10)
  }, {
    tableName: '_slon.gekkos'
  });
  return GekkosTable;
}

/*

Db.prototype.addGekko = async function(gekko){
  let exists = false;
  const config = gekko.config;
  if(gekko && gekko.config) {
    if (gekko.type === GEKKO_TYPE.WATCHER) {
      exists = await this.isExistingMarketWatcher(config.watch);
    }

    if (!exists) {
      try {
        GekkosTable.create({
          name: gekko.name,
          ownerId: gekko.ownerId,
          status: gekko.active ? GEKKO_STATUS.ACTIVE : gekko.stopped ? GEKKO_STATUS.STOPPED : null,

          gekkoId: gekko.id,
          type: gekko.type,
          mode: gekko.mode,
          jsonGekko: gekko,

          // watch: config.watch,
          // market: config.market,
          // marketFrom: config.market && config.market.from,
          // marketType: config.market && config.market.type,
          // startedAt: gekko.start,
          // lastUpdate: null,
          // duration: null,

          exchange: config.watch.exchange,
          currency: config.watch.currency,
          asset: config.watch.asset,
        });
      } catch (err1) {
        consoleError(err1);
      }
    }
  }
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
Db.prototype.archive = async function(id){
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
Db.prototype.errored = async function(id){
  let result;
  try {
    const gekkoDb = await GekkosTable.findOne({
      where: {
        gekkoId: id
      }
    });
    if(gekkoDb) {
      let jsonConfig = gekkoDb.getDataValue('jsonConfig');
      if(jsonConfig) {
        jsonConfig.active = false;
        jsonConfig.stopped = true;
        result = await GekkosTable.update({
          jsonConfig: jsonConfig,
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
// advises, trades and roundtrips:
Db.prototype.updateStats = async function(id, gekko){
  let result;
  try {
    const gekkoDb = await GekkosTable.findOne({
      where: {
        gekkoId: id
      }
    });
    if(gekkoDb) {
      let jsonConfig = gekko.config;
      if(jsonConfig) {
        result = await GekkosTable.update({
          jsonConfig: jsonConfig,
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
Db.prototype.delete = async function(id){
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
*/

const createGekkosTable = async function(model) {
  return new Promise(async (resolve, reject) => {
    model.drop({
      cascade: true
    }).then(() => {
      model.sync().then(async() => {
        resolve(true);
      }).catch(err => {
        reject(err);
        consoleError(err);
      });
    }).catch(err1 => {
      consoleError(err1);
      reject(err1);
    });
  });
}

module.exports.create = createGekkosTable;

const consoleError = function(msg) {
  console.error(msg);
  log.info('GekkosPersistent DB error:', msg);
}
