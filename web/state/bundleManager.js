const _ = require('lodash');
const moment = require('moment');

const cache = require('./cache');
const broadcast = require('./cache').get('broadcast');
let dependenciesManager = require('./cache').get('dependencies');

const Logger = require('./logger');
const pipelineRunner = require('../../core/workers/pipeline/parent');
const reduceState = require('./reduceState.js');
const now = () => moment().format('YYYY-MM-DD HH:mm');
let gekkoManager;

const BundleManager = function() {
  this.bundles = {};
  this.archivedBundles = {};
  gekkoManager = cache.get('gekkos');
}

BundleManager.prototype.add = function({ bundle }) {

  let uuid, id;
  uuid = bundle.uuid;
  id = uuid;

  let usr = cache.get('user');
  if(bundle) {
    if (id) {
      if(!bundle.isProgrammaticCreation) {
        if(usr) {
          bundle.ownerId = usr.get('id');
        } else {
          console.error('BundleManager:: add: user not authenticated or uuid not provided');
        }
      }
      bundle.id = uuid;

      this.bundles[id] = bundle;

      console.log(`${now()} Bundle ${uuid} started.`);

      broadcast({
        type: 'bundle_new',
        uuid,
        state: bundle
      });
    } else {
      console.error('BundleManager:: add: uuid not provided');
    }
  } else {
    console.error('BundleManager:: add: bundle not provided');
  }

  return bundle;
}

BundleManager.prototype.stop = function(id) {
  if(!this.bundles[ id ])
    return false;

  console.log(`${now()} stopping Bunlde ${ id }`);

  this.bundles[ id ].stopped = true;
  this.bundles[ id ].active = false;

  broadcast({
    type: 'bundle_stopped',
    id
  });

  this.archive(id);

  return true;
}

BundleManager.prototype.archive = function(id) {
  this.archivedBundles[ id ] = this.bundles[ id ];
  this.archivedBundles[ id ].stopped = true;
  this.archivedBundles[ id ].active = false;
  delete this.bundles[ id ];

  broadcast({
    type: 'bundle_archived',
    id
  });
}

BundleManager.prototype.delete = function(id) {
  if(this.bundles[ id] ) {
    throw new Error('Cannot delete a running Bundle, stop it first.');
  }

  if(!this.archivedBundles[ id ]) {
    throw new Error('Cannot delete unknown Bundle.');
  }

  console.log(`${now()} deleting Bundle ${id}`);

  broadcast({
    type: 'bundle_deleted',
    id
  });

  delete this.archivedBundles[ id ];

  return true;
}

BundleManager.prototype.restart = function({ id }) {
  let bundle = this.bundles[ id ] || this.archivedBundles[ id ];
  const user = cache.get('user');
  if(!bundle || !user)
    return false;

  console.log(`${now()} restarting Bundle ${ id }`);


  delete this.bundles[ id ];
  delete this.archivedBundles[ id ];

  this.add({ config: bundle.config });

  broadcast({
    type: 'bundle_restarted',
    id
  });

  return true;
}

BundleManager.prototype.list = function() {
  return { live: this.bundles, archive: this.archivedBundles };
}

module.exports = BundleManager;
