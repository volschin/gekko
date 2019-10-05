<template lang='pug'>
.grd.contain
  h3 Add an API key
  p Make sure that the API key has the permissions to create and cancel orders and view balances.
  .grd-row
    .grd-row-col-3-6.mx1
      h3 Exchange
      exchange-picker(v-on:exchange='updateExchange', only-tradable='true')
    .grd-row-col-3-6.mx1
      h3 Credentials
      label Unique Name
      input(v-model='uniqueName')
      template(v-for='cred in requires')
        label {{ cred }}
        input(v-model='credentials[cred]')
  .txt--center
    a.w100--s.my1.btn--primary(href='#', v-on:click.prevent='upload') Add
</template>

<script>

import exchangePicker from '../global/configbuilder/exchangepicker.vue'
import _ from 'lodash'
import { post } from '../../tools/ajax';

export default {
  data: () => {
    return {
      exchange: false,
      credentials: {},
      uniqueName: ''
    }
  },
  components: {
    exchangePicker
  },
  computed: {
    apiKeySets: function() {
      return this.$store.state.apiKeys;
    },
    exchanges: function() {
      return this.$store.state.exchanges;
    },
    requires: function() {
      if(!this.exchanges)
        return [];

      if(!this.exchange)
        return [];

      return this.exchanges[this.exchange].requires;
    },
    config: function() {
      let config = {
        exchange: this.exchange,
        uniqueName: this.uniqueName,
        values: this.credentials
      };

      return config;
    }
  },
  watch: {
    credentials: function() {
      this.emitConfig();
    }
  },
  methods: {
    updateExchange: function(exchange) {
      this.credentials = {};
      this.uniqueName = '';
      this.exchange = exchange;
      this.emitConfig();
    },
    emitConfig: function() {
      this.$emit('config', this.config);
    },
    upload: function() {

      let exchange = this.config.exchange;

      if(
        this.exchanges &&
        this.apiKeySets.includes(this.config.uniqueName) &&
        !confirm(`You already have API keys with the name "${this.config.uniqueName}" defined, do you want to overwrite them?`)
      )
          return;

      post('addApiKey', this.config, (error, response) => {
        if(error)
          return alert(error);

        this.credentials = {};
      });
    }
  }
}
</script>

<style>
</style>
