const cache = require('../state/cache');

module.exports = function(name) {
  return async function (ctx, next) {
    let list = cache.get(name).list();
    ctx.body = list;
  }
}
