const cache = require('./state/cache');
const gekkosPersistent = cache.get('gekkosPersistent');

const isUserManagerPluginEnabled = require('./routes/baseConfig').userManager && require('./routes/baseConfig').userManager.enabled === true;

const ConfigManager = {
  async add(state, userId) {
    let ret;
    if (!state) {
      throw 'config not provided';
    }
    if(isUserManagerPluginEnabled) {
      if (!userId) {
        throw 'userId not provided';
      }
    } else {
      userId = 777;
    }
    state.ownerId = userId;
    ret = await gekkosPersistent.saveConfig(state);
    return ret;
  },
  async delete({ id, userId }) {
    let ret;
    if (!id) {
      throw 'config id not provided';
    }
    if(isUserManagerPluginEnabled) {
      if (!userId) {
        throw 'userId not provided';
      }
    } else {
      userId = 777;
    }
    ret = await gekkosPersistent.deleteConfig({ id, userId });
    return ret;
  },
  async get(options) {
    let ret;

    if(isUserManagerPluginEnabled) {
      if (!options.userId) {
        throw 'userId not provided';
      }
    } else {
      options.userId = 777;
    }
    ret = await gekkosPersistent.getConfigs(options);
    return ret;
  },
}
module.exports = ConfigManager;
