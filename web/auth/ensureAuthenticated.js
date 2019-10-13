module.exports = ensureAuthenticated = function (role) {
  role = role || 'user';
  return function(ctx, next) {
    console.log(ctx.cookies.get('koa:sess'));
    console.log(ctx.cookies.get('name'));
    let res = false;
    if (ctx.isAuthenticated()) {
      // check for authorization now (roles):
      const user = ctx.state.user;
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
