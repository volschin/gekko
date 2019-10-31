<template lang='pug'>
div
  .mx1
    label(for='exchange').wrapper Exchange:
    .custom-select.button
      select(v-model='exchange')
        option(v-for='(market, e) in exchanges') {{ e }}
  .grd-row
    .grd-row-col-3-6.mx1
      label(for='currency') Currency:
      .custom-select.button
        select(v-model='currency')
          option(v-for='cur in currencies') {{ cur }}
    .grd-row-col-3-6.mx1
      label(for='assets') Assets:
      .custom-select.button
        select(v-model='selectedAssets' multiple='true' options='assets')
          option(v-for='asst in assets') {{ asst }}
      label Select All:
      input(type="checkbox" @change='onCheckAll' v-on:select="onCheckAll" onselect='onCheckAll')
  .grd-row
    label(for='selectedAssets').wrapper Or just list assets here:
    textarea(v-on:change="onChange" rows="3" v-model='selectedAssets' style="width:100%;")

</template>

<script>

import _ from 'lodash'

export default {
  props: ['onlyTradable', 'onlyImportable'],
  data: () => {
    return {
      exchange: 'binance',
      currency: 'USDT',
      selectedAssets: ['BTC', 'LTC'],
    };
  },
  created: function() {
    this.emitConfig();
  },
  computed: {
    exchanges: function() {

      let exchanges = Object.assign({}, this.$store.state.exchanges);

      if(_.isEmpty(exchanges))
        return false;

      if(this.onlyTradable) {
        _.each(exchanges, (e, name) => {
          if(!e.tradable)
            delete exchanges[name];
        });
      }

      if(this.onlyImportable) {
        _.each(exchanges, (e, name) => {
          if(!e.importable)
            delete exchanges[name];
        });
      }

      return exchanges;
    },
    markets: function() {
      return this.exchanges ? this.exchanges[ this.exchange ] : null;
    },

    assets: function() {
      let assets = this.exchanges ? this.exchanges[this.exchange].markets[this.currency] : null;
      return assets;
    },

    currencies: function() {
      return this.exchanges ? _.keys( this.exchanges[this.exchange].markets ) : null;
    },
    watchConfig: function() {
      return {
        watch: {
          exchange: this.exchange,
          currency: this.currency,
          selectedAssets: this.selectedAssets,
        }
      }
    }
  },

  watch: {
    currency: function() {
      this.emitConfig()
    },
    selectedAssets: function() { this.emitConfig() },
    market: function() { this.emitConfig() },
    exchanges: function() { this.emitConfig() },
    exchange: function() { this.emitConfig() }
  },

  methods: {

    onCheckAll: function(e){
      if(e.target.checked){
        this.selectedAssets = this.assets;
      }
    },
    onChange: function(e){
      this.selectedAssets = e.currentTarget.value && e.currentTarget.value.trim().split(',').map(a=> a.trim().toUpperCase());
    },
    emitConfig: function() {
      this.$emit('market', this.watchConfig);
    }
  }
}
</script>
<style>

</style>
