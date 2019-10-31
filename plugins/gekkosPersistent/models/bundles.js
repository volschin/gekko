const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, BundlesTable;

module.exports = function(sequelize, DataTypes) {

  BundlesTable = sequelize.define('Bundles', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING(100),
      defaultValue: Sequelize.UUIDV4,
    },
    description: {
      type: Sequelize.STRING(1000),
    },
    // gekkoIds: Sequelize.ARRAY(Sequelize.INTEGER), // not sure if needed
    ownerId: Sequelize.INTEGER,
    status: Sequelize.STRING(10),
    sendNotifications: Sequelize.BOOLEAN,
    configId: Sequelize.INTEGER
  }, {
    tableName: '_slon.bundles'
  });
  return BundlesTable;
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
  log.info('BundleTABLE DB error:', msg);
}
