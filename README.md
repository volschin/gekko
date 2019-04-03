
# Gekko Allinone Docker
 
Gekko is a Bitcoin TA trading and backtesting platform that connects to popular Bitcoin exchanges. It is written in JavaScript and runs on [Node.js 10](http://nodejs.org).
 ##  Add somes Gekko strategies from xFFFFF and backtest tool for docker container autobuild
 
 ## Build on:
 
 - LTS Nodejs 10 ...
 - Redis 2.8.0
 - mathjs
 - convnet
 - tulind and talib
 
 ## Added
 - Gekko strategies
 - gekkoga
 - backtestTool

Somes dependency were added to initial script from b16b00b5.

## Install with docker

Before start container set the correct IP adress and local Port.
If you change Ip: localhost to another and start container and it be wrong IP. change manualy IP on
nano /usr/src/app/web/vue/dist/UIconfig.js or delete container and rebuild

Ajust MEMORYNODE for max memory size under the limit of memory of container -10% was good

## TODO
- Clean dependency and somes strategies who doesnt work.

## Community & Support

Gekko has [a forum](https://forum.gekko.wizb.it/) that is the place for discussions on using Gekko, automated trading and exchanges. In case you rather want to chat in realtime about Gekko feel free to join the [Gekko Support Discord](https://discord.gg/26wMygt).

## Final

If Gekko helped you in any way, you can always leave me a tip at (BTC) 13r1jyivitShUiv9FJvjLH7Nh1ZZptumwW
