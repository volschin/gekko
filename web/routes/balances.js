const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');
const base = require('./baseConfig');
const balanceManager = require('../balanceManager');

module.exports = {
  get: async function (ctx, next) {
    const userEmail = ctx.state.user.get('email');
    const apiKeyName = ctx.params.apiKeyName;
    if(!userEmail) {
      ctx.body = {
        success: false,
        status: 'error'
      }
    } else {
      const balances = await balanceManager.getBalances(userEmail, apiKeyName);
      ctx.body = {
        status: 'ok',
        result: balances
      }
    }
  },
}
