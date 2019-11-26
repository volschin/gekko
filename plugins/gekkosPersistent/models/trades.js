// api accounts, unique by api key (one-to-one relation)
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, TradesTable;

module.exports = function(sequelize, DataTypes) {

  TradesTable = sequelize.define('Trades', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tradeId: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    apiKeyName: {
      type: Sequelize.STRING(50),
    },
    bundleUuid: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      // allowNull: false
    },
    gekkoId: {
      type: Sequelize.STRING(100),
    },
    json: Sequelize.JSON
  }, {
    tableName: '_slon.trades'
  });
  return TradesTable;
}

const createTable = async function(model) {
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

module.exports.create = createTable;

const consoleError = function(msg) {
  console.error(msg);
  log.info('TradesTABLE DB error:', msg);
}
