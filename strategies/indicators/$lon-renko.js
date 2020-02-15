let brickSize = 100; // default - 100$
let candleSize = 1; // default - 1 minute
let candlePrev = null;
const Indicator = function(options = {}) {
  this.input = 'candle';

  brickSize = options.brickSize || brickSize;
  candleSize = options.candleSize || candleSize;

  this.renkoClose = null;
  this.renkoOpen = null;

  this.direction = 'none';
}

// REMEMBER: we run this function EACH MINUTE, all mechanics is done inside
Indicator.prototype.update = function(candle) {
  // First Renko
  const direction = this.direction;
  if(this.renkoClose === null) {
    // this.renkoClose = Math.ceil(candle.close / brickSize) * brickSize;
    this.renkoClose = Math.floor(candle.close / brickSize) * brickSize;
    this.direction = 'none';
    this.isChanged = false;
    this.start = candle.start;
  } else {
    this.isChanged = false;

    // from up to up
    if ((direction === 'none' || direction === 'up') && candle.close >= this.renkoClose + brickSize ){
      this.renkoClose += brickSize;
      this.direction = 'up';
      this.isChanged = false;
      this.start = candle.start;
    }
    // from up to dn
    if ((direction === 'none' || direction === 'up') && candle.close <= (this.renkoClose - 2 * brickSize)){
      this.renkoClose -= 2 * brickSize;
      this.direction = 'dn';
      this.isChanged = true;
      this.start = candle.start;
    }
    // from dn to dn
    if ((direction === 'none' || direction === 'dn') && candle.close <= (this.renkoClose - brickSize)){
      this.renkoClose -= brickSize;
      this.direction = 'dn';
      this.isChanged = false;
      this.start = candle.start;
    }
    // from dn to up
    if ((direction === 'none' || direction === 'dn') && candle.close >= (this.renkoClose + 2 * brickSize)){
      this.renkoClose += 2 * brickSize;
      this.direction = 'up';
      this.isChanged = true;
      this.start = candle.start;
    }

    // this.renkoOpen = this.renkoClose;
  }
  this.result = this.renkoClose;
  candlePrev = candle;
}

module.exports = Indicator;
