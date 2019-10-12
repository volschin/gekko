const _ = require('lodash');
const fs = require('fs').promises;

const parts = {
  paperTrader: 'config/plugins/paperTrader',
  candleWriter: 'config/plugins/candleWriter',
  performanceAnalyzer: 'config/plugins/performanceAnalyzer'
}

const gekkoRoot = __dirname + '/../../';

module.exports = async function (ctx, next) {
  if(!_.has(parts, ctx.params.part))
    return ctx.body = 'error :(';

  const fileName = gekkoRoot + '/' + parts[ctx.params.part] + '.toml';
  ctx.body = {
    part: await fs.readFile(fileName, 'utf8')
  }
}
