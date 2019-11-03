import { get } from '../../../tools/ajax'
import store from '../../'
import { bus } from '../../../components/global/ws'
import { alert } from '../../../tools/ui';

const init = () => {
  get('imports', (err, resp) => {
    if(err) {
      // alert('Недостаточно прав!')
    } else {
      store.commit('syncImports', resp);
    }
  });
}

const sync = () => {
  bus.$on('import_update', data => {
    store.commit('updateImport', data);
  });
}

export default function(isResync) {
  init();
  if(!isResync) {
    sync();
  }
}
