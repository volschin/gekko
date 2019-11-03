import { get } from '../../../tools/ajax'
import store from '../../'
import { bus } from '../../../components/global/ws'
import _ from 'lodash'

const init = () => {
  get('bundles', (err, resp) => {
    const bundles = resp;
    store.commit('syncBundles', bundles);
  });
}

const sync = () => {
  bus.$on('bundle_new', data => store.commit('addBundle', data.state));
  bus.$on('bundle_event', data => store.commit('updateBundle', data));
  bus.$on('bundle_archived', data => store.commit('archiveBundle', data.id));
  bus.$on('bundle_error', data => store.commit('errorBundle', data));
  bus.$on('bundle_deleted', data => store.commit('deleteBundle', data.id));
}

export default function(isResync) {
  init();
  if(!isResync) {
    sync();
  }
}
