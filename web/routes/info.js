const p = require('../../package.json');

// Retrieves API information
module.exports = async function (ctx) {
  ctx.body = {
    version: p.version
  }
}
