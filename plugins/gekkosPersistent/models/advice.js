"use strict";

const _ = require('lodash');

module.exports = function(sequelize, DataTypes) {
  let adviceShema = sequelize.define('Advice', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    gekkoId: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    // object itself
    adviceId: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    recommendation: {
      type: DataTypes.STRING(15)
    },
    date: DataTypes.DATE,
    // timestamps: true,
  }, {
    tableName: '_slon.advices'
  });
  adviceShema.add = async function(advice) {
    if(advice) {
      try {
        adviceShema.create({
          gekkoId: advice.gekkoId,
          adviceId: advice.adviceId,
          recommendation: advice.recommendation,
          date: advice.date
        });
      } catch (err1) {
        consoleError(err1);
      }
    }
  }
  adviceShema.delete = async function(gekkoId){
    let result;
    try {
      result = await adviceShema.destroy({
        where: {
          gekkoId
        }
      });
    } catch (err1) {
      consoleError(err1);
    }
    return result;
  }
  adviceShema.getAll = async function(gekkoId) {
    let where;
    if(gekkoId){
      where = {
        gekkoId
      }
    } else {
      where = {}
    }
    try {
      const ret = await adviceShema.findAll({
        where
      });
    } catch (err1) {
      consoleError(err1);
    }
    return ret;
  }

  return adviceShema;
}

const createAdvicesTable = async function(model) {
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

module.exports.create = createAdvicesTable;

const consoleError = function(msg) {
  console.error(msg);
  log.info('GekkosPersistent DB error:', msg);
}


/*

{
"id": "advice-1",
"recommendation": "long",
"date": "2019-10-18T21:11:00.000Z"
},

 */
