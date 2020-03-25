const cache = require('../state/cache');
const gekkoManager = cache.get('gekkos');

// stops a Gekko
// requires a post body with an id
module.exports = async function (ctx) {

  let id = ctx.request.body.id;

  if(!id) {
    ctx.body = { status: 'not ok' }
    return;
  }

  let result = gekkoManager.command(id, {
    name: 'forceBuy'
  });

  if(!result.success) {
    ctx.body = { status: `not ok: ${ JSON.stringify( result.reason) }, data: ${ JSON.stringify( result.payload)}` }
    return;
  }

  ctx.body = { status: 'ok' };
}
