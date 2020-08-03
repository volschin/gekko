const _ = require('lodash');
const cache = require('./state/cache');
const apiKeyManager = cache.get('apiKeyManager');

const broadcast = cache.get('broadcast');
const pickBy = require('lodash.pickby');
const Broker = require('../exchange/gekkoBroker');
const exchangeUtils = require('../exchange/exchangeUtils');
const retry = exchangeUtils.retry;
const isUserManagerPluginEnabled = require('./routes/baseConfig').userManager && require('./routes/baseConfig').userManager.enabled === true;

const balanceManagerModule = {
  getBalances(userEmail, apiKeyName) {
    if (!apiKeyName) {
      throw 'apiKeyName not provided';
    }
    if(isUserManagerPluginEnabled) {
      if (!userEmail) {
        throw 'userEmail not provided';
      }
    } else {
      userEmail = undefined;
    }
    return new Promise((resolve, reject) => {
      let configCur, promisesArr = [];
      const apiKeys = apiKeyManager.getFull(userEmail);
      if(apiKeys) {
        let apiKey = _.toArray(apiKeys).filter(ak => ak.uniqueName === apiKeyName)[0];
        if(apiKey && (apiKey.userEmail === userEmail)) {
          const slug = apiKey.exchange.toLowerCase();
          if(slug === 'binance') {
            configCur = {
              currency: 'USDT',
              asset: 'BTC',
              private: true,
              exchange: apiKey.exchange,
              key: apiKey.key, // add your API key
              secret: apiKey.secret // add your API secret
            }
            const API = require('../exchange/wrappers/' + slug);

            let api = new API(configCur);
            api.getPortfolio((err, res, data)=> {
              if(err) {
                reject(err);
              } else {
                try {
                  let result = data ? data.balances.map(b => {
                    return { asset: b.asset, free: Number.parseFloat(b.free), locked: Number.parseFloat(b.locked) }
                  }).filter(b => {
                    return b.free > 0 || b.locked > 0
                  }) : err;
                  resolve(result);
                } catch (err2) {
                  reject(err2);
                }
              }
            });
          } else {
            resolve([]);
          }
        }
      } else {
        resolve([]);
      }
    });
  },
  getAllBalances(userEmail) {
    if(isUserManagerPluginEnabled) {
      if (!userEmail) {
        throw 'userEmail not provided';
      }
    } else {
      userEmail = null;
    }
    return new Promise((resolve, reject) => {
      let configCur, promisesArr = [];
      const apiKeys = apiKeyManager.getFull(userEmail);
      if(apiKeys) {
        _.toArray(apiKeys).forEach(apiKey => {
          if(apiKey && (isUserManagerPluginEnabled? apiKey.userEmail === userEmail : true)) {
            const slug = apiKey.exchange.toLowerCase();
            if(slug === 'binance') {
              configCur = {
                currency: 'USDT',
                asset: 'BTC',
                private: true,
                exchange: apiKey.exchange,
                key: apiKey.key, // add your API key
                secret: apiKey.secret // add your API secret
              }
              const API = require('../exchange/wrappers/' + slug);

              promisesArr.push(new Promise((resolve1, reject1) => {
                let api = new API(configCur);
                api.getPortfolio((err, res, data)=> {
                  try {
                    let result = data.balances.map(b => {
                      return { asset: b.asset, free: Number.parseFloat(b.free), locked: Number.parseFloat(b.locked) }
                    }).filter(b => {
                      return b.free > 0 || b.locked > 0
                    });
                    resolve1({ name: apiKey.uniqueName, balances: result });
                  } catch(err2) {
                    reject1(err2);
                  }
                });
              }));

            } else {
              // need to update getBalance function in other exchanges' wrappers to make it work
            }
          } else {

          }
        });
        Promise.all(promisesArr).then(res1 => {
          resolve(res1);
        }).catch(err1 => {
          reject(err1);
        })
      } else {
        resolve([])
      }
    });

  }

}
module.exports = balanceManagerModule;
