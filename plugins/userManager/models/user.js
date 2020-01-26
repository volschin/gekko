"use strict";

const bcrypt = require('bcrypt-nodejs');
const _ = require('lodash');

module.exports = function(sequelize, DataTypes) {
  let userSchema = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullName: {
      type: DataTypes.STRING,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'guest'
    }
  }, {
    tableName: '_slon.users',
    timestamps: false,
    getterMethods: {
      comparePassword: function(password, hash, callback) {
        // if bcrypt.compare() succeeds it'll call our function with
        // (null, true), if password doesn't match it calls our function
        // with (null, false), if it errors out it calls our function
        // with (err, null)
        bcrypt.compare(password, hash, function(err, isMatch) {
          if(err) {
            return callback && callback(err, null);
          } else {
            callback && callback(null, isMatch);
          }
        });
      },
      associate: function(models) {
        // TODO: define association of user model
        // something like User.hasMany(Pen);
      },
    }
  });
  userSchema.comparePasswordAsync = function(password, hash, callback) {
    // if bcrypt.compare() succeeds it'll call our function with
    // (null, true), if password doesn't match it calls our function
    // with (null, false), if it errors out it calls our function
    // with (err, null)
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, hash, function(err, isMatch) {
        if(err) {
          return reject(err, );
        } else {
          resolve(isMatch);
        }
      });
    });
  };
  userSchema.generatePasswordHash = function(user, options, callback) {
    var SALT_WORK_FACTOR = 10;

    const res = new Promise((resolve, reject) => {
      bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if(err) {
          reject(err);
        }
        // generate salt.
        bcrypt.hash(user.password, salt, null, function(err, hash) {
          if(err) {
            reject(err);
          }
          // replace the password with the hash and pass on the
          // user object to whoever should require it.
          user.password = hash;
          resolve(user);
        });
      });
    });
    return res;
  }
  // This hook is called when an entry is being added to the back end.
  // This method is used to hash the password before storing it
  // in our database.
  userSchema.addHook('beforeCreate', function(user, options, callback) {
    const res = userSchema.generatePasswordHash(user, options, callback);
    return res;
  });
  if(false) {
    createAndSeed(userSchema);
  }

  return userSchema;
}
function createAndSeed(model){
  const users = [ /*{
    username: 'xxx',
    email: 'xxx',
    password: 'xxx',
    role: 'admin'
  }*/ ];

  return new Promise(async (resolve, reject) => {
    model.drop({
      cascade: true
    }).then(() => {
      model.sync().then(async () => {
        const result = await Promise.all(_.each(users, u=> model.create(u))).catch(err => {
          console.error('Promise.all: ');
          console.error(err);
          reject(err)
        });
        resolve(result);
      }).catch(err => {
        console.error('model.sync: ');
        console.error(err);
        reject(err);
      });
    }).catch(err => {
      console.error('model.drop: ');
      console.error(err);
      reject(err);
    });
  });
}
