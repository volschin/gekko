<template lang='pug'>
div
  .mx1
    div(v-if='isTradebot')
      label(for='exchange').wrapper Api Key Name:
    div(v-if='isPaperTrader')
      div(v-if='!apiSelectorIsOn')
        a(v-on:click.prevent='switchToggle') Add Api Paper Key (only for testing)
      div(v-if='apiSelectorIsOn')
        a(v-on:click.prevent='switchToggle') Close Api Paper Key
    .custom-select.button(v-if='isTradebot || isPaperTrader && apiSelectorIsOn')
      select(v-model='apiKeyName')
        option(v-for='(market, e) in apiKeysNames') {{ market }}
</template>

<script>

import _ from 'lodash'

export default {
  props: ['isPaperTrader'],
  data: () => {
    return {
      apiKeyName: '',
      apiSelectorIsOn: false
    };
  },
  created: function() {
    this.emitConfig();
  },
  computed: {
    isTradebot: function() {
      return !this.isPaperTrader;
    },
    apiKeysNames: function() {

      let apiKeysNames = Object.assign({}, this.$store.state.apiKeys);

      if(_.isEmpty(apiKeysNames))
        return false;

      if(_.isEmpty(this.apiKeyName)){
        this.apiKeyName = this.$store.state.apiKeys[0]
      }

      return apiKeysNames;
    },
  },

  watch: {
    apiKeysNames: function() { this.emitConfig() },
    apiKeyName: function() { this.emitConfig() }
  },

  methods: {
    emitConfig: function() {
      this.$emit('apiKeyPicked', this.apiKeyName);
    },
    switchToggle: function() {
      this.apiSelectorIsOn = !this.apiSelectorIsOn;
    },
  }
}
</script>
<style>

</style>
