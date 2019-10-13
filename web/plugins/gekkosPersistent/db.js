const Sequelize = require('sequelize');
const { Op } = require('sequelize');

const util = require('../../../core/util.js');

let modelsSequelize, config, GekkosTable;
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
const Db = function(settings){
  config = util.getConfig();
  let connectionString = config.postgresql.connectionString + '/' + config.postgresql.database;
  modelsSequelize = new Sequelize(connectionString);
  GekkosTable = modelsSequelize.define('Gekkos',
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        defaultValue: Sequelize.UUIDV4,
      },
      ownerId: Sequelize.INTEGER,
      status: Sequelize.STRING(10),

      gekkoId: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      type: Sequelize.STRING(20),
      mode: Sequelize.STRING(20),
      jsonGekko: Sequelize.JSON,

      exchange: Sequelize.STRING(30),
      currency: Sequelize.STRING(10),
      asset: Sequelize.STRING(10)
    }, {
      tableName: 'gekkos'
    });
  if(false){
    let res = createGekkosTable(GekkosTable);
  }
}
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
          ownerId: 0, // todo
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
        console.error(err1);
      }
    }
  }
}
Db.prototype.updateJsonGekko = async function(id, gekko){
  let result;

  if(id) {
    result = await GekkosTable.update({
      jsonGekko: gekko,
    }, {
      where: {
        gekkoId: id
      }
    });
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
  return result;
}
Db.prototype.errored = async function(id){
  let result;
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
  return result;
}
// advises, trades and roundtrips:
Db.prototype.updateStats = async function(id, gekko){
  let result;
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
  return result;
}
Db.prototype.delete = async function(id){
  let result;
  result = await GekkosTable.destroy({
    where: {
      gekkoId: id
    }
  });
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

module.exports = Db;
module.exports.GEKKO_TYPE = GEKKO_TYPE;
module.exports.GEKKO_STATUS = GEKKO_STATUS;

const createGekkosTable = async function(model) {
  return new Promise(async (resolve, reject) => {
    model.drop({
      cascade: true
    }).then(() => {
      model.sync().then(async() => {
        resolve(true);
      }).catch(err => {
        reject(err);
      });
    }).catch(err => {
      reject(err);
    });
  });
}

const getMarketTableName = function(config){
  return `Market_${config.exchange}_${config.currency}_${config.asset}`;
}
