const moment = require('moment');
const { WebClient } = require('@slack/web-api');
const _ = require('lodash');
const log = require('../core/log.js');
const util = require('../core/util.js');
const config = util.getConfig();
const slackConfig = config.slack;
let buyReason;
let sellReason;

const Slack = function(done) {
  _.bindAll(this);

  // this.slack;
  this.price = 'N/A';

  this.done = done;
  this.setupWebApi();
  //this.setupRTM(); // todo
};
const gekkoNameShort = `G-${ getRandomFromRange(100, 999) }`;

Slack.prototype.setupWebApi = function(done) {
  let options = CreateOptionsFromConfig(config);
  const gekkoNameHash = CreateNameHash(options);
  this.slack = new WebClient(slackConfig.token);

  const setupSlack = function(error, result) {
    console.log('config,', config);
    const text = `Gekko started! (${ gekkoNameShort })`;
    if (slackConfig.sendMessageOnStart) {
      const body = this.createResponse(
        [], [], text, {
          id: gekkoNameShort
        });
      this.send(body, gekkoNameHash);
    } else {
      log.debug('Skipping Send message on startup');
    }
  };
  setupSlack.call(this);
};

// https://github.com/SlackAPI/node-slack-sdk#using-the-real-time-messaging-api
Slack.prototype.setupRTM = function(done) {
  const { RTMClient } = require('@slack/rtm-api');

  // An access token (from your Slack app or custom integration - usually xoxb)
  const token = process.env.SLACK_TOKEN;

  // The client is initialized and then started to get an active connection to the platform
  const rtm = new RTMClient(token);
  rtm.start().catch(console.error);

  // Calling `rtm.on(eventName, eventHandler)` allows you to handle events (see: https://api.slack.com/events)
  // When the connection is active, the 'ready' event will be triggered
  rtm.on('ready', async () => {

    // Sending a message requires a channel ID, a DM ID, an MPDM ID, or a group ID
    // The following value is used as an example
    const conversationId = 'C1232456';

    // The RTM client can send simple string messages
    const res = await rtm.sendMessage('Hello there', conversationId);

    // `res` contains information about the sent message
    console.log('Message sent: ', res.ts);
  });

// After the connection is open, your app will start receiving other events.
  rtm.on('user_typing', (event) => {
    // The argument is the event as shown in the reference docs.
    // For example, https://api.slack.com/events/user_typing
    console.log(event);
  });
};

Slack.prototype.createResponse = function(attachments, blocks, text, gekkoObject) {
  attachments = attachments || [];
  blocks = blocks || [];
  text = text || ' ';
  gekkoObject = gekkoObject || {}

  const that = this;
  const options = CreateOptionsFromConfig(config);

  /*let mainSection = {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `${ text }`
    }
  }*/
  // text && blocks.push(mainSection);
  blocks.push(DETAILS_OVERFLOW_TEMPLATE(options, this));

  attachments.unshift(ATTACHMENT_HEADER_TEMPLATE(gekkoObject, {
    pretext: text,
    text: '',
    // title: `${ gekkoObject.id } details`
  }));

  const template = {
    'username': that.createUserName(),
    'icon_url': that.createIconUrl(),
    'text': `${ text }`, // this is what is seen on mobile notifications

    'attachments': attachments,
    'blocks': blocks,
  };

  return template;
};
Slack.prototype.processCandle = function(candle, done) {
  this.price = candle.close;
  done();
};

// processAdvice
// processTradeInitiated
// processPortfolioChange
// processPortfolioValueChange
// processTradeCompleted
let messagesHash = {}
let lastBuyTrade;
let initialBalance;

Slack.prototype.processAdvice = function(advice, a, b, c) {
  return ; // don't show for now
  let text, color, options = {}, template;
  if (advice.recommendation === 'soft' && slackConfig.muteSoft) return;

  if (advice.recommendation === 'long') {
    color = 'good';
    text = `${ gekkoNameShort } Advised: BUY`;
  } else if (advice.recommendation === 'short') {
    color = 'danger';
    text = `${ gekkoNameShort } Advised: SELL`;
  } else {
    // warning
    color = 'warning';
  }
  console.log('adv:'+ JSON.stringify(advice));
  color = '';
  options.color = color;
  Object.assign(options, advice);
  const body = this.createResponse([], [], text, advice);
  this.sendGekkoEvent(body, advice);
};

Slack.prototype.processTradeInitiated = function(pendingTrade) {
  let text, color, options = {}, template, reason = 'N/A';
  if(!initialBalance){
    initialBalance = pendingTrade.balance;
  }

  if (pendingTrade.action === 'buy') {
    color = 'warning';
    text = `Trade Initiated: BUY`;
    reason = buyReason;
  } else if (pendingTrade.action === 'sell') {
    color = 'warning';
    text = `Trade Initiated: SELL`;
    reason = sellReason;
  } else {
    // warning
    color = 'warning';
  }
  color = '';
  options.color = color;
  Object.assign(options, pendingTrade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "Reason",
          "value": `${ reason }`,
          "short": true
        },
        {
          "title": "Asset",
          "value": `${ pendingTrade.portfolio.asset }`,
          "short": true
        },
        {
          "title": "Currency",
          "value": `${ pendingTrade.portfolio.currency }`,
          "short": true
        },
        {
          "title": "Balance",
          "value": `${ pendingTrade.balance }`,
          "short": false
        },
        {
          "title": "Date",
          "value": `${ pendingTrade.date }`,
          "short": false
        },
      ],
    }
  ], [], text, pendingTrade);
  this.sendGekkoEvent(body, pendingTrade);
};

Slack.prototype.processTradeAborted = function(trade) {
  console.log('processTradeAborted');
  let text, color, options = {};

  text = 'Trade Aborted!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": true
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

Slack.prototype.processTradeCancelled = function(trade) {
  console.log('processTradeCancelled');
  let text, color, options = {};

  text = 'Trade Cancelled!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": true
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

Slack.prototype.processTradeErrored = function(trade) {
  console.log('processTradeErrored');
  let text, color, options = {};

  text = 'Trade Errored!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": true
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

Slack.prototype.processPortfolioChange = function(portfolio) {
  //{
  //   "asset": 0.017,
  //   "currency": 0
  // }
  //{
  //   "asset": 0,
  //   "currency": 0.00014828
  // }
  console.log('processPortfolioChange');
};

Slack.prototype.processPortfolioValueChange = function(portfolioValue) {
  // debugger;
  //console.log('processPortfolioValueChange');
};

Slack.prototype.processTradeCompleted = function(trade) {
  let text, color, options = {}, buyTrade, isTradeSuccess = true;

  if (trade.action === 'buy') {
    color = 'warning';
    text = `Trade Completed: BUY`;
    lastBuyTrade = trade;
  } else if (trade.action === 'sell') {
    color = 'warning';
    text = `Trade Completed: SELL`;
    buyTrade = lastBuyTrade;
    if(buyTrade){
      if(buyTrade.balance >= trade.balance){
        isTradeSuccess = false;
        color = 'danger';
      } else {
        isTradeSuccess = true;
        color = 'good';
      }
    }
  } else {
    color = 'warning';
  }

  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "Cost",
          "value": `${ trade.cost }`,
          "short": false
        },
        {
          "title": "Amount",
          "value": `${ trade.amount }`,
          "short": false
        },
        {
          "title": "Price",
          "value": `${ trade.price }`,
          "short": false
        },
        {
          "title": "Effective Price",
          "value": `${ trade.effectivePrice }`,
          "short": false
        },
        {
          "title": "Fee Percent",
          "value": `${ trade.feePercent }`,
          "short": false
        },
        {
          "type": "divider",
        },
        {
          "title": "Balance",
          "value": trade.action === 'buy'?`${ trade.balance }`:
            `${ trade.balance } (${ ((trade.balance - buyTrade.balance) / buyTrade.balance * 100).toFixed(3) }%, 
            total: ${ ((trade.balance - initialBalance) / initialBalance * 100).toFixed(3) }%)`,
          "short": false
        },
        {
          "title": "Date",
          "value": `${ trade.date }`,
          "short": false
        },
        {
          "title": "Asset",
          "value": `${ trade.portfolio.asset }`,
          "short": true
        },
        {
          "title": "Currency",
          "value": `${ trade.portfolio.currency }`,
          "short": true
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

Slack.prototype.processStratNotification = function({ content }) {
  console.log('processStratNotification', content);
  if(content.type === 'buy advice' ){
    buyReason = content.reason;
  } else if( content.type === 'sell advice'){
    sellReason = content.reason;
  }
  // const body = this.createResponse('#909399', content);
  // this.send(body);
};

Slack.prototype.sendGekkoEvent = function(content, object) {
  const id = object && object.id;
  const parentHash = CreateNameHash(CreateOptionsFromConfig(config));

  content['channel'] = slackConfig.channel;

  const res = this.slack.chat.postMessage(content);
  res.then((res1) => {
    let msgObj = {
      ts: res1.ts
    }
    if(id){
      msgObj['gekkoId'] = parentHash;
      msgObj['object'] = object;
      messagesHash[id] = msgObj;
    }
  });

  // same for response ( to show as replies of the corresponding 'Gekko Started' message)
  content['thread_ts'] = messagesHash[ parentHash ].ts;
  content['reply_broadcast'] = false;
  // content['as_user'] = true;
  // content['username'] = this.createUserName();
  const res1 = this.slack.chat.postMessage(content);
}
Slack.prototype.send = function(content, id) {
  content['channel'] = slackConfig.channel;
  const res = this.slack.chat.postMessage(content);
  res.then((res1) => {
    console.log('Message sent: ', res1);
    let msgObj = {
      ts: res1.ts
    }
    if(id){
      messagesHash[id] = msgObj;
    }
  });
};

Slack.prototype.checkResults = function(error) {
  if (error) {
    log.warn('error sending slack', error);
  } else {
    log.info('Send advice via slack.');
  }
};

Slack.prototype.createUserName = function() {
  const serverName = config.name || 'unknown server';
  return config.watch.exchange[0].toUpperCase() + config.watch.exchange.slice(1) + '-' + config.watch.currency + '/' + config.watch.asset
    + `(${ gekkoNameShort } `;
    // + `(${serverName}): ${config.tradingAdvisor.method} `;
};

Slack.prototype.createIconUrl = function() {
  const asset = config.watch.asset === 'XBT' ? 'btc' : config.watch.asset.toLowerCase();
  return 'https://github.com/cjdowner/cryptocurrency-icons/raw/master/128/icon/' + asset + '.png';
};

module.exports = Slack;

// See: https://api.slack.com/methods/chat.postMessage
// https://api.slack.com/docs/message-buttons
// https://api.slack.com/docs/messages/builder

const ATTACHMENT_HEADER_TEMPLATE = (options, options2) => {
  options = options || {};
  const date = options.date || moment();
  return {
    'pretext': `${ options2.pretext || ''}`,
    'text': `${ options2.text || ''}`,
    'title': `${ options2.title || ''}`,
    'footer': `${ options.id ? 'Id ' +  options.id : ''}`,
    'footer_icon': 'https://platform.slack-edge.com/img/default_application_icon.png',
    'ts': date.unix(),
  };
};
const CreateOptionsFromConfig = (config) => {
  const options = {
    server: config.name,
    exchange: config.watch.exchange.toUpperCase(),
    strategy: config.tradingAdvisor.method,
    pair: config.watch.currency + '/' + config.watch.asset,
  }
  return options;
}

const CreateNameHash = (options) => {
  options = options || {};
  let ret = `gekko_${ options.server }_${options.exchange}_${options.strategy}_${ options.pair }_${ gekkoNameShort }`;
  return ret;
}
const GetParentGekkoMessage = ()=>{
  return messagesHash[CreateNameHash(CreateOptionsFromConfig(config))];
}
const DETAILS_OVERFLOW_TEMPLATE = (options, that) => {
  options = options || {};
  let messageId = '';
  const parentMessage = GetParentGekkoMessage();
  messageId = parentMessage && `p${ parentMessage.ts.replace('.','') }` || '';
  return {
    "type": "section",
    "block_id": "section 890",
    "text": {
      "type": "mrkdwn",
      "text": " "
    },
    "accessory": {
      /*"type": "static_select",
      "placeholder": {
        "type": "plain_text",
        "text": "See Gekko Details",
        "emoji": true
      },*/
      "type": "overflow",
      "options": [
        {
          "text": {
            "type": "plain_text",
            "text": `SERVER: ${ options.server }`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": `EXCHANGE: ${options.exchange}`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": `STRATEGY: ${options.strategy}`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": `PAIR: ${ options.pair }`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": "View Gekko thread"
          },
          "url": `https://buzzar.slack.com/archives/${ slackConfig.channel }/${ messageId }`
        },
      ],
      "action_id": "overflow"
    }
  }
}

const BUY_INTERACTION_BUTTONS_TEMPLATE = (options, that) => {
  options = options || {};
  return {
    'username': that.createUserName(),
    'icon_url': that.createIconUrl(),
    'text': `Advised: BUY`,
    'attachments': [
      {
        'text': 'React to advice manually (or simply wait for bot):',
        'fallback': 'You are unable to choose a game',
        'callback_id': 'wopr_game',
        'color': options.color,
        'attachment_type': 'default',
        'actions': [
          {
            'name': 'sell_now',
            'text': 'SELL NOW',
            'type': 'button',
            'style': 'danger',
            'value': 'sell_now',
            'confirm': {
              'title': 'Are you sure?',
              'text': 'You can lose money',
              'ok_text': 'Yes',
              'dismiss_text': 'No',
            },
          },
          {
            'name': 'market_order',
            'text': 'SELL ORDER',
            'type': 'button',
            'value': 'market_order',
          },
        ],
      },
    ],
  };
};

function getRandomFromRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
