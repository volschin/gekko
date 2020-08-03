// works as united performance analizer, for all gekkos, that share by the same Api Key ("Account")

let db;

// temp:
const _ = require('lodash');
const log = require('../../core/log.js');
const cache = require('../../web/state/cache');
const base = require('../../web/routes/baseConfig');

const AccountPerformanceAnalyser = function(){

};

module.exports = AccountPerformanceAnalyser;

function consoleError(msg){
  console.error(msg);
  log.info(msg);
}
function consoleLog(msg){
  console.log(msg);
  log.info(msg);
}
