// api accounts, unique by api key (one-to-one relation)
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, AccountsTable;

module.exports = function(sequelize, DataTypes) {

  AccountsTable = sequelize.define('Accounts', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    apiKeyName: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    gekkoIds: {
      type: Sequelize.ARRAY(Sequelize.STRING(100)),
      defaultValue: []
    },
    // ownerId: Sequelize.INTEGER,
    // watchers: Sequelize.ARRAY(Sequelize.JSON),
    isAdvised: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    balances: {
      type: Sequelize.JSON,
      defaultValue: {}
    }
    /*    name: {
      type: Sequelize.STRING(50),
    },
    description: {
      type: Sequelize.STRING(1000),
    },*/
  }, {
    tableName: '_slon.accounts'
  });
  return AccountsTable;
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
  log.info('AccountsTABLE DB error:', msg);
}
