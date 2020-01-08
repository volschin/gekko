import { get, del } from '../../../tools/ajax';
import store from '../../index';
import { transformConfigs } from './sync';

export const FETCH_CONFIG_LIST = ({ commit, dispatch, state }) => {
  return new Promise((resolve, reject) => {
    get('configs', (err, resp) => {
      if(err) {
        reject(err);
      } else {
        const configs = transformConfigs(resp);
        store.commit('syncConfigs', configs);
        resolve(configs);
      }
    });
  });
}
export const FETCH_TOP_CONFIG_LIST = ({ commit, dispatch, state }, { payload }) => {
  return new Promise((resolve, reject) => {
    get(`configs/top/${ payload.amount || 10 }`, (err, resp) => {
      if(err) {
        reject(err);
      } else {
        const configs = transformConfigs(resp);
        store.commit('syncConfigs', configs);
        resolve(configs);
      }
    });
  });
}

export const FETCH_CONFIG_CURRENT = ({ commit, dispatch, state }, options = {} ) => {
  return new Promise((resolve, reject) => {
    const configId = options.payload.configId;
    if(!configId) {
      reject('configId not provided!');
      return;
    }
    get(`configs/${ configId }`, (err, resp) => {
      if(err) {
        reject(err);
      } else {
        const configs = transformConfigs(resp);
        const config = configs.length && configs.length > 0 ? configs[0]: null;
        store.commit('syncConfigCurrent', config);
        resolve(config);
      }
    });
  });
}

export const DELETE_CONFIG = ({ commit, dispatch, state }, options = {} ) => {
  return new Promise((resolve, reject) => {
    const configId = options.payload.configId;

    if(!configId) {
      reject('configId not provided!');
      return;
    }
    del(`configs/${ configId }`, (err, resp) => {
      if(err) {
        reject(err);
      } else {
        const configs = transformConfigs(resp);
        store.commit('syncConfigs', configs);
        resolve(configs);
      }
    });
  });
}
