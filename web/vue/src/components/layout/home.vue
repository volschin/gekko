<template lang='pug'>
  div
    section.contain.grd-row
      .grd-row-col-3-6(v-html='left')
      .grd-row-col-3-6.txt--center
        img(src='static/gekko.jpg')
        p(v-if='Date.now() % 5 === 0')
          em Mr. $LON is certainly [ the smartest guy ] in the room!
        p(v-if='Date.now() % 5 === 1')
          em There are bulls, bears .. and Mr. $LON!
        p(v-if='Date.now() % 5 === 2')
          em Who is The King of the Jungle? .. Mr. $LON!
        p(v-if='Date.now() % 5 === 3')
          em Mr. $LON never forgets [ backtest 'em all! ]
        p(v-if='Date.now() % 5 === 4')
          em Eye of the $LON: got the guts - got the glory!
    section.contain.grd-row
      .grd-row-col-6.txt--center(v-if='!isAuthenticated')
        router-link.button--backtest.w100--s.my1.btn--primary(v-if='!isAuthenticated' to='/login').py1 Login

</template>

<script>
import marked from '../../tools/marked';

const left = marked(`

## $LON

$LON is a trading bot and backtesting website that
connects to popular exchanges.

It is forked from Gekko and has few modifications
[Find out more](https://gekko.wizb.it/).


`);

export default {
  data: () => {
    return {
      left
    }
  },
  computed: {
    isAuthenticated (){
      return this.$store.state.auth.isAuthenticated
    },
  }
}
</script>
