const config = require('./vue/dist/UIconfig');
const baseConfig = require('./routes/baseConfig');

const koa = require('koa');
const serve = require('koa-static');
const cors = require('@koa/cors');
const _ = require('lodash');
const bodyParser = require('koa-bodyparser');

const opn = require('opn');
const server = require('http').createServer();
const router = new require('koa-router')();
const ws = require('ws');
const app = new koa();

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });

const cache = require('./state/cache');

const nodeCommand = _.last(process.argv[1].split('/'));
const isDevServer = nodeCommand === 'server' || nodeCommand === 'server.js';

let DependencyManager, GekkosPersistent, ensureAuthenticated = function() { // used for stubbing non-enabled plugins
  cache.set('user', {
    get: function(prop) {
      if(prop === 'id'){
        return 777;
      }
    }
  });
  return async function(ctx, next) {
    await next();
  }
}
  , isUserManagerPluginEnabled = baseConfig.userManager && baseConfig.userManager.enabled === true;

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.ping(_.noop);
  ws.on('error', e => {
    console.error(new Date, '[WS] connection error:', e);
  });
});


setInterval(() => {
  wss.clients.forEach(ws => {
    if(!ws.isAlive) {
      console.log(new Date, '[WS] stale websocket client, terminiating..');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(_.noop);
  });
}, 10 * 1000);

// broadcast function
const broadcast = data => {
  if(_.isEmpty(data)) {
    return;
  }

  const payload = JSON.stringify(data);

  wss.clients.forEach(ws => {
    ws.send(payload, err => {
      if(err) {
        console.log(new Date, '[WS] unable to send data to client:', err);
      }
    });
  });
  wss.emit(data.type, data);
}
cache.set('broadcast', broadcast);
cache.set('wss', wss);

const ListManager = require('./state/listManager');
const GekkoManager = require('./state/gekkoManager');
const BundleManager = require('./state/bundleManager');

// initialize lists and dump into cache
cache.set('imports', new ListManager);
cache.set('gekkos', new GekkoManager);
cache.set('bundles', new BundleManager);

// load server plugins (defined in the same baseConfig file as gekko plugins):
try {
  if(baseConfig.dependencyManager && baseConfig.dependencyManager.enabled === true){
    DependencyManager = require('../plugins/dependencyManager/web');
    cache.set('dependencies', new DependencyManager());
  }
} catch (e) {
  console.error(e);
  console.error('Note: if you enable "dependencyManager" plugin in baseConfig.js, you need to have it installed to plugins folder!');
}
try {
  if(isUserManagerPluginEnabled) {
    ensureAuthenticated = require('../plugins/userManager/auth/ensureAuthenticated');
    require('../plugins/userManager/auth/passport');
  }
} catch (e) {
  console.error(e);
  console.error('Note: if you enable "userManager" plugin in baseConfig.js, you need to have it installed to plugins folder!');
}

cache.set('apiKeyManager', require('./apiKeyManager'));

try {
  if(baseConfig.gekkosPersistent && baseConfig.gekkosPersistent.enabled === true){
    GekkosPersistent = require('../plugins/gekkosPersistent/web');
    cache.set('gekkosPersistent', new GekkosPersistent());
  }
} catch (e) {
  console.error(e);
  console.error('Note: if you enable "gekkosPersistent" plugin in baseConfig.js, you need to have it installed to plugins folder!');
}

// setup API routes

const WEBROOT = __dirname + '/';
const ROUTE = n => WEBROOT + 'routes/' + n;

// attach routes
const apiKeys = require(ROUTE('apiKeys'));
router.get('/api/info', require(ROUTE('info')));
router.get('/api/strategies', ensureAuthenticated(), require(ROUTE('strategies')));
router.get('/api/configPart/:part', ensureAuthenticated(), require(ROUTE('configPart')));
router.get('/api/apiKeys', ensureAuthenticated(), apiKeys.get);
router.get('/api/balances/:apiKeyName', ensureAuthenticated(), require(ROUTE('balances')).get);

const listWraper = require(ROUTE('list'));
router.get('/api/imports', ensureAuthenticated('admin'), listWraper('imports'));
router.get('/api/gekkos', ensureAuthenticated(), listWraper('gekkos'));
router.get('/api/exchanges', ensureAuthenticated(), require(ROUTE('exchanges')));

router.post('/api/addApiKey', ensureAuthenticated(), apiKeys.add);
router.post('/api/removeApiKey', ensureAuthenticated(), apiKeys.remove);
router.post('/api/scan', ensureAuthenticated(), require(ROUTE('scanDateRange')));
router.post('/api/scansets', ensureAuthenticated(), require(ROUTE('scanDatasets')));
router.post('/api/backtest', ensureAuthenticated(), require(ROUTE('backtest')));
router.post('/api/batchBacktest', ensureAuthenticated(), require(ROUTE('batchBacktest')));
router.post('/api/import', ensureAuthenticated('admin'), require(ROUTE('import')));
router.post('/api/getCandles', ensureAuthenticated(), require(ROUTE('getCandles')));

// GEKKOS:
router.post('/api/startGekko', ensureAuthenticated(), require(ROUTE('startGekko')));
router.post('/api/stopGekko', ensureAuthenticated(), require(ROUTE('stopGekko')));
router.post('/api/deleteGekko', ensureAuthenticated(), require(ROUTE('deleteGekko')));
router.post('/api/restartGekko', ensureAuthenticated(), require(ROUTE('restartGekko')));
router.post('/api/forceBuyGekko', ensureAuthenticated(), require(ROUTE('forceBuyGekko')));
router.post('/api/forceSellGekko', ensureAuthenticated(), require(ROUTE('forceSellGekko')));

// BUNDLES:
router.post('/api/bundleStop', ensureAuthenticated(), require(ROUTE('bundleStop')));
router.post('/api/bundleStart', ensureAuthenticated(), require(ROUTE('bundleStart')));
router.post('/api/bundleDelete', ensureAuthenticated(), require(ROUTE('bundleDelete')));
router.post('/api/bundleRestart', ensureAuthenticated(), require(ROUTE('bundleRestart')));
router.get('/api/bundles', ensureAuthenticated(), listWraper('bundles'));

// CONFIGS:
router.post('/api/configs/new', ensureAuthenticated(), require(ROUTE('configSave')));
router.get('/api/configs', ensureAuthenticated(), require(ROUTE('configsGet')));
router.get('/api/configs/:id', ensureAuthenticated(), require(ROUTE('configsGet')));
router.get('/api/configs/top/:amount', ensureAuthenticated(), require(ROUTE('configsGet')));
router.delete('/api/configs/:id', ensureAuthenticated(), require(ROUTE('configsDelete')));

// ACCOUNTS PERFORMANCE REPORTS (WIP!):
//router.get('/api/getCustomPerformanceReport', ensureAuthenticated(), require(ROUTE('getCustomPerformanceReport')));

// AUTH:
if(isUserManagerPluginEnabled) {
  router.post('/auth/login', require('../plugins/userManager/routes/login'));
// router.post('/auth/google', require(ROUTE('login')));
  router.post('/auth/register', require('../plugins/userManager/routes/register'));
  router.post('/auth/logout', require('../plugins/userManager/routes/logout'));
  router.post('/auth/changePassword', require('../plugins/userManager/routes/passwordChange'));
// router.post('/account/user-details', ensureAuthenticated(), require(ROUTE('account').userDetails));
  app.keys = ['super-secret-key =]'];
}
// incoming WS:
// wss.on('connection', ws => {
//   ws.on('message', _.noop);
// });


app
  .use(serve(WEBROOT + 'vue/dist'))
  .use(bodyParser())
  .use(require('koa-logger')())

if(isUserManagerPluginEnabled) {
  const passport = require('koa-passport');
  const session = require('koa-session');
  app
    .use(cors({
      // origin: '*',
      origin: `${ config.ui.ssl ? 'https' : 'http' }://${ process.env['HOST'] || config.api.host }:${ process.env['PORT'] || config.api.port }`,
      allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
      // allowHeaders: 'Origin, X-Requested-With, Content-Type, Accept',
      credentials: 'true'
    }))
    .use(session({}, app))
    .use(passport.initialize()) // for user accounts
    .use(passport.session()) // for user accounts
    .use(async function(ctx, next) { // authenticate custom static files (logs):
      if (/\.log$/.test(ctx.originalUrl)) {
        return ensureAuthenticated('admin')(ctx, next);
      } else {
        return next();
      }
    })
}
app
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve(WEBROOT + '../logs')); // serve static logs (to admins-only)

server.timeout = config.api.timeout || 120000;
server.on('request', app.callback());
server.listen(config.api.port, config.api.host, '::', () => {
  const host = `${config.ui.host}:${config.ui.port}${config.ui.path}`;

  if(config.ui.ssl) {
    var location = `https://${host}`;
  } else {
    var location = `http://${host}`;
  }

  console.log('Serving Gekko UI on ' + location +  '\n');


  // only open a browser when running `node gekko`
  // this prevents opening the browser during development
  if(!isDevServer && !config.headless) {
    opn(location)
      .catch(err => {
        console.log('Something went wrong when trying to open your web browser. UI is running on ' + location + '.');
    });
  }
});

broadcast({
  type: 'server_started'
})
