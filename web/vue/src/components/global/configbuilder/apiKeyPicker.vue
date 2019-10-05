<template lang='pug'>
div
  .mx1
    label(for='exchange').wrapper Api Key Name:
    .custom-select.button
      select(v-model='apiKeyName')
        option(v-for='(market, e) in apiKeysNames') {{ market }}</template>

<script>

import _ from 'lodash'

export default {
  // props: ['onlyTradable', 'onlyImportable'],
  data: () => {
    return {
      apiKeyName: ''
    };
  },
  created: function() {
    this.emitConfig();
  },
  computed: {
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
    }
  }
}
</script>
<style>

</style>
