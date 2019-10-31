const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, ConfigsTable;

module.exports = function(sequelize, DataTypes) {

  ConfigsTable = sequelize.define('Configs',
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
      description: {
        type: Sequelize.STRING(1000),
      },
      ownerId: Sequelize.INTEGER,

      gekkoId: Sequelize.STRING(100),
      bundleId: Sequelize.UUID,


      exchange: Sequelize.STRING(30),
      currency: Sequelize.STRING(10),
      assets: Sequelize.ARRAY(Sequelize.STRING(10)),
      strategy: Sequelize.STRING(50),

      paramsJson: Sequelize.JSON,
      configJson: Sequelize.JSON,

      optionsJson: Sequelize.JSON,
      watchJson: Sequelize.JSON,
      tradingAdvisorJson: Sequelize.JSON,

      isBundle: Sequelize.BOOLEAN //?
    }, {
      tableName: '_slon.configs'
    });
  return ConfigsTable;
}

const createConfigsTable = async function(model) {
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

module.exports.create = createConfigsTable;

const consoleError = function(msg) {
  console.error(msg);
  log.info('GekkosPersistent DB error:', msg);
}
