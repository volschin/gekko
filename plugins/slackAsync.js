const { WebClient } = require('@slack/web-api');
const _ = require('lodash');
const log = require('../core/log.js');
const util = require('../core/util.js');
const config = util.getConfig();
const slackConfig = config.slackAsync;

const SlackAsync = function(done) {
    _.bindAll(this);

    this.slack;
    this.price = 'N/A';

    this.done = done;
    this.setupWebApi();
    //this.setupRTM(); // todo
};

SlackAsync.prototype.setupWebApi = function(done) {
    this.slack = new WebClient(slackConfig.token);

    const setupSlack = function(error, result) {
        if(slackConfig.sendMessageOnStart){
          const body = this.createResponse("#439FE0","Gekko started!") ;
          this.send(body);
        }else{
            log.debug('Skipping Send message on startup')
        }
      this.done();
    };
    setupSlack.call(this)
};

// https://github.com/SlackAPI/node-slack-sdk#using-the-real-time-messaging-api
SlackAsync.prototype.setupRTM = function(done) {
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
  })
};

SlackAsync.prototype.processCandle = function(candle, done) {
    this.price = candle.close;
    done();
};

SlackAsync.prototype.processAdvice = function(advice) {
  let body = {}, color, options = {}, template;
	if (advice.recommendation == 'soft' && slackConfig.muteSoft) return;

	// const color = advice.recommendation === "long" ? "good" : (advice.recommendation === "short" ? "danger" : "warning");
  // const body = this.createResponse(color, "There is a new trend! The advice is to go `" + advice.recommendation + "`! Current price is `" + this.price + "`");
  if(advice.recommendation === 'long'){
    color = 'good';
    template = BUY_INTERACTION_BUTTONS_TEMPLATE;
  } else if(advice.recommendation === 'short') {
    color = 'danger';
    template = SELL_INTERACTION_BUTTONS_TEMPLATE;
  } else {
    // warning
    color = 'warning';
  }
  options.color = color;
  Object.assign(options, advice);
  body = template && template(options);
  body.attachments && body.attachments[0] && Object.assign(body.attachments[0], FOOTER_TEMPLATE(options));
  this.send(body);
};

SlackAsync.prototype.processStratNotification = function({ content }) {
  const body = this.createResponse('#909399', content);
  this.send(body);
}

SlackAsync.prototype.send = function(content, done) {
  (async () => {
    content.channel = slackConfig.channel;

    const res = await this.slack.chat.postMessage(content);

    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })();
};

SlackAsync.prototype.checkResults = function(error) {
    if (error) {
        log.warn('error sending slack', error);
    } else {
        log.info('Send advice via slack.');
    }
};

SlackAsync.prototype.createResponse = function(color, message) {
  const template = {
    "username": this.createUserName(),
    "icon_url": this.createIconUrl(),
    "attachments": [
      {
        "fallback": "",
        "color": color,
        "text": message,
        "mrkdwn_in": ["text"]
      }
    ]
  };

  return template;
};

SlackAsync.prototype.createUserName = function() {
  return config.watch.exchange[0].toUpperCase() + config.watch.exchange.slice(1) + " - " + config.watch.currency + "/" + config.watch.asset;
};

SlackAsync.prototype.createIconUrl = function() {
  const asset = config.watch.asset === "XBT" ? "btc" :config.watch.asset.toLowerCase();
  return "https://github.com/cjdowner/cryptocurrency-icons/raw/master/128/icon/" + asset + ".png";
};

module.exports = SlackAsync;

// See: https://api.slack.com/methods/chat.postMessage
// https://api.slack.com/docs/message-buttons
// https://api.slack.com/docs/messages/builder
const BUY_INTERACTION_BUTTONS_TEMPLATE = (options)=> {
  options = options || {};
  return {
    "text": `BUY trade advised`,
    "attachments": [
      {
        "text": "React to advice manually (or simply wait for bot):",
        "fallback": "You are unable to choose a game",
        "callback_id": "wopr_game",
        "color": options.color,
        "attachment_type": "default",
        "actions": [
          {
            "name": "sell_now",
            "text": "SELL NOW",
            "type": "button",
            "style": "danger",
            "value": "sell_now",
            "confirm": {
              "title": "Are you sure?",
              "text": "You can lose money",
              "ok_text": "Yes",
              "dismiss_text": "No"
            }
          },
          {
            "name": "market_order",
            "text": "SELL ORDER",
            "type": "button",
            "value": "market_order"
          }
        ]
      }
    ]
  }
}

const SELL_INTERACTION_BUTTONS_TEMPLATE = (options)=> {
  options = options || {};
  return {
    "text": `SELL trade advised`,
    "attachments": [
      {
        "text": "React to advice manually (or simply wait for bot):",
        "fallback": "You are unable to choose a game",
        "callback_id": "wopr_game",
        "color": options.color,
        "attachment_type": "default",
      }
    ]
  }
}

const FOOTER_TEMPLATE = (options)=> {
  options = options || {};
  return {
    "footer": `TradeId ${ options.id}`,
    "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
    "ts": options.date && options.date.unix()
  }
}
