'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const config = require('../../../core/util.js').getConfig();
const uiConfig = require('../../../web/vue/public/UIconfig');

const connectionString = config[uiConfig.adapter] && (config[uiConfig.adapter].connectionString + '/' + config[uiConfig.adapter].database);
const sequelize = new Sequelize(connectionString, {
  pool: {
    max: 15,
    min: 0,
    idle: 10000
  }
});

const db = {};

fs.readdirSync(__dirname).filter(function(file) {
    return (file.indexOf(".") !== 0) && (file !== 'index.js');
  }).forEach(function(file) {
    let model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
