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
  console.error('!! getDependencyResults')

  this.startDependencies(config);
  console.error('!! dependenciesManager.startDependencies');
}
DependencyManager.prototype.getDependencyResultsAsync = async function (config) {
  console.error('!! getDependencyResults')

  await this.startDependenciesAsync(config);
  console.error('!! dependenciesManager.startDependencies');

  return new Promise((resolve, reject) =>{
    const fileName = `${ util.dirs().gekko }/logs/dependencyManagerResults.json`;

    fs.readFile(
      fileName,
      (err, data) => {
        console.error('!! dependenciesManager.readFile');
        results = JSON.parse(data);
        config.dependencyResults = results;
        // util.setConfigProperty(null, 'dependencyResults', results);

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
      const depName = getNameFromConfig(stateDep);
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
  let curDep, stateDep = {};
  if(state && state.dependencies && state.dependencies.length > 0 ) {
    for(let i = 0; i < state.dependencies.length; i++ ) {
      curDep = state.dependencies[i];
      _.merge(stateDep, state, curDep);
      stateDep.isDependency = true;
      const depName = getNameFromConfig(stateDep);
      curDep.name = depName;

      await pipelineRunner('backtest', stateDep);
    }
  }
}
// static methods:
DependencyManager.getClosestResult = function (date, results) {
  // console.error('config.dependencyResults getClosestResult');
  // console.log(date);
  // console.error('asking  date is:', date.toString())
  let ret =  {
    trend: -1,
    trendChange: -2
  };
  if(results && date && results.length > 0) {
    const dateTs = new Date(date).getTime();
    let rPrev, dCur, dLast;
    for (let i1 = 0; i1 < results.length; i1++) {
      dCur = results[i1].ts;
      if (dateTs >= dCur) {
        rPrev = results[i1];
        dLast = dCur;
        // console.log(dateTs, dCur, results[i1], i1);
      } else {
        // console.error(dateTs, dCur, results[i1], i1);
        break;
      }
    }
    ret = rPrev && rPrev.data || ret;

  }
  return ret;
}

module.exports = DependencyManager;

const getNameFromConfig = function(config){
  let ret = `${ config.watch.exchange }_${ config.watch.currency }_${ config.watch.asset }_${
    config.tradingAdvisor.method }_${ JSON.stringify(config[ config.tradingAdvisor.method ]) }_${
    config.tradingAdvisor.candleSize }_${ config.tradingAdvisor.historySize }_${ config.backtest.daterange.from }_${ config.backtest.daterange.to }`;
  return ret;
}
