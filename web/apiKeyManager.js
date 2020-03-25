const fs = require('fs');
const _ = require('lodash');
const cache = require('./state/cache');
const broadcast = cache.get('broadcast');
const pickBy = require('lodash.pickby');

const apiKeysFile = __dirname + '/../SECRET-api-keys.json';
const isUserManagerPluginEnabled = require('./routes/baseConfig').userManager && require('./routes/baseConfig').userManager.enabled === true;

let apiKeys;
/*// on init:
const noApiKeysFile = !fs.existsSync(apiKeysFile);

if(noApiKeysFile)
  fs.writeFileSync(
    apiKeysFile,
    JSON.stringify({})
  );

const apiKeys = JSON.parse( fs.readFileSync(apiKeysFile, 'utf8') );*/

const apiKeyManagerModule = {
  getAllApis: function() {
    return apiKeys;
  },
  writeApisFile: function() {
    let apiKeys1;
    const apiKeysFile = __dirname + '/../SECRET-api-keys.json';

    // on init:
    const noApiKeysFile = !fs.existsSync(apiKeysFile);

    if(noApiKeysFile)
      fs.writeFileSync(
        apiKeysFile,
        JSON.stringify({})
      );

    apiKeys1 = JSON.parse( fs.readFileSync(apiKeysFile, 'utf8') );
    return apiKeys1;
  },
  get: (userEmail) => {
    if(isUserManagerPluginEnabled) {
      if (!userEmail)
        return;
    } else {
      userEmail = undefined;
    }
    const keysFiltered = pickBy(apiKeys, k => k.userEmail === userEmail);
    return _.keys(keysFiltered);
  },
  getFull: (userEmail) => {
    if(isUserManagerPluginEnabled) {
      if (!userEmail)
        return;
    } else {
      userEmail = undefined;
    }
    const keysFiltered = pickBy(apiKeys, k => k.userEmail === userEmail);
    return keysFiltered;
  },
  // note: overwrites if exists, only if his own
  add: (exchange, props) => {
    props = props || {}
    if(!isUserManagerPluginEnabled) {
      props.userEmail = undefined;
    }
    if(isUserManagerPluginEnabled? props.userEmail: true) {
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
    if(isUserManagerPluginEnabled) {
      if (!apiKeys[uniqueName] || !userEmail)
        return;
    } else {
      userEmail = undefined;
    }
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
apiKeys = apiKeyManagerModule.writeApisFile();

module.exports = apiKeyManagerModule;
