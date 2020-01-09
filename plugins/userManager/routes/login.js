const cache = require('../../../web/state/cache');
const manager = cache.get('apiKeyManager');
const _ = require('lodash');
const passport = require('koa-passport');
const loginUser = require('../auth/loginUser');

module.exports = async function (ctx, next) {
  return passport.authenticate('local', { session: true }, (err, user, info, status) => {
    if (user) {
      const token = loginUser(user);

      ctx.body = { success: true, token, user }; // todo!!
      ctx.login(user);

      return next();
    } else {
      cache.set('user', null);

      ctx.body = { success: false };
      ctx.throw(401);
    }
  })(ctx);
}
