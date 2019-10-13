<template lang='pug'>
  div
    section.contain.grd-row
      .grd-row-col-3-6(v-html='left')
      .grd-row-col-3-6.txt--center
        img(src='static/gekko.jpg')
        p
          em The most valuable commodity I know of is information.
    section.contain.grd-row
      .grd-row-col-6.txt--center(v-if='!isAuthenticated')
        router-link.button--backtest.w100--s.my1.btn--primary(v-if='!isAuthenticated' to='/login').py1 Login

</template>

<script>
import marked from '../../tools/marked';

const left = marked(`

## Gekko

Gekko is a Bitcoin trading bot and backtesting platform that
connects to popular Bitcoin exchanges. It is written in javascript
and runs on nodejs.

[Find out more](https://gekko.wizb.it/).

*Gekko is 100% free (open source), if you paid for this you have been scammed.*

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
