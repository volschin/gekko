const cache = require('../../../web/state/cache');

module.exports = ensureAuthenticated = function (role) {
  role = role || 'user';
  return function(ctx, next) {
    let res = false;
    const user = ctx.state.user;
    if(ctx.isAuthenticated() && user) {
      cache.set('user', user);
    } else {
      cache.set('user', null);
    }
    if (ctx.isAuthenticated()) {
      // check for authorization now (roles):
      if(user) {
        if(role === 'user' && (user.role === 'user' || user.role === 'admin' || user.role === 'host')) {
          return next();
        } else if(role === 'admin' && (user.role === 'admin' || user.role === 'host')) {
          return next();
        } else if(role === 'host' && (user.role === 'host')) {
          return next();
        } else {
          ctx.status = 403;
          ctx.body = { status: 'Unauthorized' };
        }
      }
    } else {
      ctx.status = 401;
      ctx.body = { status: 'Unauthenticated' };
    }
  }
}
