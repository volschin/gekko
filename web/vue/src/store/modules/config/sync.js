import { get } from '../../../tools/ajax'
import store from '../../'
import { bus } from '../../../components/global/ws'

export const transformConfigs = data => {
  return data.map(config => {
    let ret = config.configJson;
    Object.assign(ret, {
      id: config.id,
      name: config.name
    });
    return ret;
  })
}

const transformMarkets = backendData => {
  if(!backendData) {
    return {};
  }

  var exchangesRaw = backendData;
  var exchangesTemp = {};

  exchangesRaw.forEach(e => {
    exchangesTemp[e.slug] = exchangesTemp[e.slug] || {markets: {}};

    e.markets.forEach( pair => {
      let [ currency, asset ] = pair['pair'];
      exchangesTemp[e.slug].markets[currency] = exchangesTemp[e.slug].markets[currency] || [];
      exchangesTemp[e.slug].markets[currency].push( asset );
    });

    if ("exchangeMaxHistoryAge" in e) {
      exchangesTemp[e.slug].exchangeMaxHistoryAge = e.exchangeMaxHistoryAge;
    }

    exchangesTemp[e.slug].importable = e.providesFullHistory ? true : false;
    exchangesTemp[e.slug].tradable = e.tradable ? true : false;
    exchangesTemp[e.slug].requires = e.requires;
  });

  return exchangesTemp;
}


const init = () => {
  get('apiKeys', (err, resp) => {
    store.commit('syncApiKeys', resp);
  });

  get('exchanges', (err, resp) => {
    store.commit('syncExchanges', transformMarkets(resp));
  });

  get('configs', (err, resp) => {
    if(err) {
      console.error(err);
    } else {
      store.commit('syncConfigs', transformConfigs(resp));
    }
  });
}

const sync = () => {
  bus.$on('apiKeys', data => {
    store.commit('syncApiKeys', data.exchanges);
  });
  bus.$on('configs', data => {
    store.commit('syncConfigs', data.exchanges);
  });
}

export default function(isResync) {
  init();
  if(!isResync) {
    sync();
  }
}
