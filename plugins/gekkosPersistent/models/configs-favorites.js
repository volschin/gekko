const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const log = require('../../../core/log.js');
const util = require('../../../core/util.js');

let config, GekkoConfigsFavoritesTable;

module.exports = function(sequelize, DataTypes) {

  GekkoConfigsFavoritesTable = sequelize.define('Gekko-configs-favorites',
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
      configId: Sequelize.INTEGER,
      ownerId: Sequelize.INTEGER,
    }, {
      tableName: '_slon.configsFavorites'
    });
  return GekkoConfigsFavoritesTable;

}


const createGekkoConfigsTable = async function(model) {
  return new Promise(async (resolve, reject) => {
    model.drop({
      cascade: false
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

module.exports.create = createGekkoConfigsTable;

const consoleError = function(msg) {
  console.error(msg);
  log.info('GekkosPersistent DB error:', msg);
}
