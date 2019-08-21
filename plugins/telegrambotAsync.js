var log = require('../core/log');
var moment = require('moment');
var _ = require('lodash');
var util = require('../core/util');
var config = util.getConfig();
var utc = moment.utc;
const TelegramBot = require("node-telegram-bot-api");

var telegramfancy = require("tgfancy");


const Telegraf = require('telegraf')



var TelegrambotAsync = function (done) {
  _.bindAll(this);

  this.chatId = null;
  this.bot = new telegramfancy(config.telegrambotAsync.token, { polling: false });
  this.bot.onText(/(.+)/, this.verifyQuestion);


  const bot1 = new TelegramBot(config.telegrambotAsync.token, {
    polling: true
  });
  bot1.on('message', (msg) => {
    console.log(msg)
  }) // прослушка на событие
  bot1.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
  });
  bot1.on('webhook_error', (error) => {
    console.log(error.code);  // => 'EPARSE'
  });

  const bot2 = new Telegraf(config.telegrambotAsync.token)
  bot2.start((ctx) => ctx.reply('Welcome'))
  bot2.on('text', (next) => {
    console.log('replyWithLocation');
  });
  bot2.catch((err) => {
    console.log('Ooops', err)
  })
  bot2.launch();

  this.done = done;
  this.done(); // this can be called anywhere async
  log.addRemoteLogger(this);
}

util.makeEventEmitter(TelegrambotAsync);

TelegrambotAsync.prototype.processAdvice = function (advice) {
  setTimeout(()=>{
    // did not test this!!!
    log.info('advice =', advice.recommendation); // advice is an array carrying long/short and candle array info
    if (this.chatId) {
      var message;
      if (advice.recommendation == 'short') {
        message = "SELL order received, sending to exchange";
      }
      if (advice.recommendation == 'long') {
        message = "BUY order received, sending to exchange";
      }
      this.bot.sendMessage(this.chatId, message);
    }
  }, 1);

}

TelegrambotAsync.prototype.processTrade = function (trade) {
  if (this.chatId) {
    this.bot.sendMessage(this.chatId, "Trade completed!");
    this.bot.sendMessage(this.chatId, trade.date.toDate() + ": " + trade.action + " at " + trade.price.toFixed(2));
    // emit portfolio command to get results of trade
    this.emit('command', {
      command: 'portfolio',
      arguments: [null],
      handled: false,
      response: null
    });
  }
}

TelegrambotAsync.prototype.verifyQuestion = function (msg, text) {
  this.chatId = msg.chat.id;

  // simple parsing that supports a command and single argument
  var tokens = text[1].split(" ");

  if (tokens.length == 1 || tokens.length == 2) {
    var command = tokens[0].toLowerCase();
    var arg = tokens.length == 2 ? tokens[1].toLowerCase() : null;
    this.emitCommand(command, arg);
  }
  else {
    this.bot.sendMessage(this.chatId, "'" + text[1] + "' - syntax error");
  }
}

TelegrambotAsync.prototype.emitCommand = function(command, arg) {
  var cmd = {
    command: command.replace('/',''),
    arguments: [arg],
    handled: false,
    response: null
  };

  this.emit('command', cmd);
  if (cmd.handled) {
    if (cmd.response) {
      this.bot.sendMessage(this.chatId, cmd.response);
    }
  }
  else {
    this.bot.sendMessage(this.chatId, "'" + cmd.command + "' - unrecognised command");
  }
}

TelegrambotAsync.prototype.logError = function (message) {
  log.error('Telegram ERROR:', message);
};

TelegrambotAsync.prototype.logRemote = function (message) {
  if (this.chatId) {
    this.bot.sendMessage(this.chatId, message);
  }
}

module.exports = TelegrambotAsync;
