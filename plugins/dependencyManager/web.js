const _ = require('lodash');

const promisify = require('tiny-promisify');
const pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));
const util = require('../../core/util.js');
const fs = require('fs');
const log = require('../../core/log');

let results = [];
const dirs = util.dirs();
const pipelineSync = require(dirs.core + 'pipeline');

const DependencyManager = function() {
}

DependencyManager.prototype.getDependencyResults = function (config) {
  this.startDependencies(config);
}
DependencyManager.prototype.getDependencyResultsAsync = async function (config) {
  await this.startDependenciesAsync(config);

  return new Promise((resolve, reject) =>{
    const configDep = DependencyManager.GetDepConfigFromConfig(config);
    let resultsObj;

    const fileName = `${ util.dirs().gekko }/logs/${ DependencyManager.GetNameFromConfig(configDep) }.json`;
    fs.readFile(
      fileName,
      (err, data) => {
        resultsObj = JSON.parse(data);
        config.dependencyResults = resultsObj;
        if(err) {
          log.error('unable to read backtest result', err);
          reject(err);
        } else {
          log.info('written backtest to: ', util.dirs().gekko + fileName);
          resolve();
        }
      }
    );
  });
}
DependencyManager.prototype.startDependencies = function (state) {
  let curDep, stateDep = {};
  if(state && state.dependencies && state.dependencies.length > 0 ) {
    for(let i = 0; i < state.dependencies.length; i++ ) {
      curDep = state.dependencies[i];
      _.merge(stateDep, state, curDep);
      stateDep.isDependency = true;
      const depName = DependencyManager.GetNameFromConfig(stateDep);
      curDep.name = depName;
      let origConfig = util.getConfig();
      util.setConfig(stateDep);
      pipelineSync({
        mode: 'backtest',
        config: stateDep
      });
    }
  }
}
DependencyManager.prototype.startDependenciesAsync = async function (state) {
  let stateDep = {};
  if(state && state.dependencies && state.dependencies.length > 0 ) {
    for(let i = 0; i < state.dependencies.length; i++ ) {
      stateDep = DependencyManager.GetDepConfigFromConfig(state, i);
      const depName = DependencyManager.GetNameFromConfig(stateDep);
      stateDep.name = depName;

      await pipelineRunner('backtest', stateDep);
    }
  }
}
// static methods:
DependencyManager.getClosestResult = function (date, results) {
  // console.error('config.dependencyResults getClosestResult');
  // console.log(date);
  // console.error('asking  date is:', date.toString())
  let ret;

  if(results && date && results.length > 0) {
    const dateTs = new Date(date).getTime();
    let rPrev, dCur, dLast;
    for (let i1 = 0; i1 < results.length; i1++) {
      dCur = results[i1].ts;
      if (dateTs >= dCur) {
        ret = results[i1].data;
        // console.log(dateTs, dCur, results[i1], i1);
      } else {
        // console.error(dateTs, dCur, results[i1], i1);
        break;
      }
    }
    // ret = rPrev && rPrev.data || ret;

  }
  return ret;
}
DependencyManager.GetDepConfigFromConfig = function(config, index) {
  index = index || 0;
  let curDep, configDep = {};
  curDep = config.dependencies[index];
  _.merge(configDep, config, curDep);
  delete configDep.dependencies;
  configDep.isDependency = true;
  return configDep;
}
DependencyManager.GetNameFromConfig = function(config){
  let ret = `${ config.watch.exchange }_${ config.watch.currency }_${ config.watch.asset }_${
    config.tradingAdvisor.method }_${ JSON.stringify(config[ config.tradingAdvisor.method ]) }_${
    config.tradingAdvisor.candleSize }_${ config.tradingAdvisor.historySize }_${ config.backtest.daterange.from }_${ config.backtest.daterange.to }`;
  ret = ret.replace(new RegExp('[ :, \", {, }, \$ ]', 'g'), '_');
  ret = getHashFromString(ret);

  return ret;
}

function getHashFromString(str) {
  let hash = 0
  for (let i = 0; i < str.length; ++i)
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0

  return hash.toString();
}

module.exports = DependencyManager;


