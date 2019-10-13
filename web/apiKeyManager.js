const fs = require('fs');
const _ = require('lodash');
const cache = require('./state/cache');
const broadcast = cache.get('broadcast');
const pickBy = require('lodash.pickby');

const apiKeysFile = __dirname + '/../SECRET-api-keys.json';

// on init:
const noApiKeysFile = !fs.existsSync(apiKeysFile);

if(noApiKeysFile)
  fs.writeFileSync(
    apiKeysFile,
    JSON.stringify({})
  );

const apiKeys = JSON.parse( fs.readFileSync(apiKeysFile, 'utf8') );

const apiKeyManagerModule = {
  get: (userEmail) => {
    if(!userEmail)
      return;
    const keysFiltered = pickBy(apiKeys, k => k.userEmail && k.userEmail === userEmail);
    return _.keys(keysFiltered);
  },

  // note: overwrites if exists, only if his own
  add: (exchange, props) => {
    props = props || {}
    if(props.userEmail) {
      if(apiKeys[props.uniqueName] && apiKeys[props.uniqueName].userEmail !== props.userEmail) {
        throw 'already exists'
      } else {
        props['exchange'] = exchange;
        apiKeys[props.uniqueName] = props;
        fs.writeFileSync(apiKeysFile, JSON.stringify(apiKeys));

        broadcast({
          type: 'apiKeys',
          exchanges: apiKeyManagerModule.get(props.userEmail)
        });
      }
    } else {
      throw 'not authenticated'
    }
  },
  remove: (uniqueName, userEmail) => {
    if(!apiKeys[uniqueName] || !userEmail)
      return;
    if(apiKeys[uniqueName] && apiKeys[uniqueName].userEmail === userEmail) {
      delete apiKeys[uniqueName];
      fs.writeFileSync(apiKeysFile, JSON.stringify(apiKeys));

      broadcast({
        type: 'apiKeys',
        exchanges: apiKeyManagerModule.get(userEmail)
      });
    }
  },

  // retrieve api keys
  // this cannot touch the frontend for security reaons.
  _getApiKeyPair: key => apiKeys[key]
}
module.exports = apiKeyManagerModule;
