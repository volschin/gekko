// api accounts, unique by api key (one-to-one relation)
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, ApisTable;

module.exports = function(sequelize, DataTypes) {
  ApisTable = sequelize.define('Apis', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    uniqueName: {
      type: Sequelize.STRING,
      allowNull: false,
      uniqueKey: true
    },
    userEmail: {
      type: Sequelize.STRING,
    },
    key: {
      type: Sequelize.STRING,
    },
    secret: {
      type: Sequelize.STRING,
    },
    exchange: {
      type: Sequelize.STRING,
      allowNull: false
    },
    tradeGekkoId: DataTypes.STRING(100),
    gekkosIds: {
      type: Sequelize.ARRAY(Sequelize.STRING(100)),
      defaultValue: []
    }
  }, {
    tableName: '_slon.apis'
  });
  return ApisTable;
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
  log.info('ApisTABLE DB error:', msg);
}
