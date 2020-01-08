<template lang='pug'>
  div
    section.contain.grd-row
      .grd-row-col-3-6
        div(v-html='left')
        top-ten-configs()
      .grd-row-col-3-6.txt--center
        img(src='static/gekko.jpg')
        p(v-if='Date.now() % 7 === 0')
          em Mr. $LON is certainly [ the smartest guy ] in the room!
        p(v-if='Date.now() % 7 === 1')
          em There are bulls, bears .. and Mr. $LON!
        p(v-if='Date.now() % 7 === 2')
          em Who is The King of the Jungle? .. Mr. $LON!
        p(v-if='Date.now() % 7 === 3')
          em Mr. $LON never forgets [ backtest 'em all! ]
        p(v-if='Date.now() % 7 === 4')
          em Eye of the $LON: got the guts - got the glory!
        p(v-if='Date.now() % 7 === 5')
          em In the jungle you must wait...until the dice read five or eight.
        p(v-if='Date.now() % 7 === 6')
          em This will not be an easy mission - monkeys slow the expedition.
    section.contain.grd-row
      .grd-row-col-6.txt--center(v-if='!isAuthenticated')
        router-link.button--backtest.w100--s.my1.btn--primary(v-if='!isAuthenticated' to='/login').py1 Login

</template>

<script>
import marked from '../../tools/marked';
import topTenConfigs from '../config/topTenConfigs';
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
  },
  components: {
    topTenConfigs
  }
}
</script>
