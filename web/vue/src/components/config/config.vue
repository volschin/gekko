<template lang='pug'>
div.contain
  h2 Config
  .hr
  h3 Available API keys
  p(v-if='!apiKeySets.length')
    em You don't have any API keys yet.
  ul
    li(v-for='exchange in apiKeySets')
      a(href='#', v-on:click.prevent='showBalancesTable(exchange)') {{ exchange }} (
      a(href='#', v-on:click.prevent='removeApiKey(exchange)') remove
      | )
      div(v-if='exchange === selectedKey')
        div(v-for='balance in balances') {{ balance.asset }} | {{ balance.free }} | {{ balance.locked }}
  a.btn--primary(href='#', v-if='!addApiToggle', v-on:click.prevent='openAddApi') Add an API key
  template(v-if='addApiToggle')
    .hr
    apiConfigBuilder
  .hr
  h3 Saved Configs
  p(v-if='!configs.length')
    em You don't have any saved configs.
  ul
    li(v-for='config in configs')
      hr
      span {{ config.name }}
      span &nbsp
      span(v-if='config.options.result')
        span , {{ config.options.result.profit }}% in {{ config.options.result.timespan }} (~ {{ config.options.result.yearlyProfit }}% / year)
      br
      router-link(:to='`backtest?configId=${ config.id }`') [ Backtest ]
      span &nbsp
      router-link(:to='`live-gekkos/new?configId=${ config.id }`') [ Live Gekko ]
      span &nbsp
      a(href='#', v-on:click.prevent='deleteConfig(config)') ( delete )
      json-view(:data='{ config }' rootKey="Details")
  .hr
  change-password
</template>

<script>
import apiConfigBuilder from './apiConfigBuilder.vue';
import { post, get } from '../../tools/ajax';
import { JSONView } from "vue-json-component";
import Vue from 'vue';
import ChangePassword from '../auth/userAccount';

export default Vue.extend({
  components: {
    ChangePassword,
    apiConfigBuilder,
    "json-view": JSONView
  },
  data: () => {
    return {
      selectedKey: '',
      addApiToggle: false,
      balances: [],
      columns: ['free', 'locked'],
    }
  },
  mounted: async function() {
    this.$store.dispatch('FETCH_CONFIG_LIST').then(response => {
      // TODO: stop the ajax spinner, loading is done at this point.
    }, error => {
      console.error(error);
      this.$toast({
        text: 'Could not fetch configs',
        fullText: error,
        icon: 'error'
      });
    });
  },
  methods: {
    getBacktestingUrl(config) {
      return `backtest?configId=${ config.id }`;
    },
    deleteConfig: async function(config) {
      const res = await this.$swal({
        title: 'Are you sure?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        reverseButtons: true
      });
      if(res.value === true) {
        this.$store.dispatch({
          type: 'DELETE_CONFIG',
          payload: { configId: config.id }
        }).then(response => {
          // TODO: stop the ajax spinner, loading is done at this point.
        }, error => {
          console.error(error);
        });
      }
    },
    showConfigData: async function(config) {
      const { value: configName } = await this.$swal({
        title: config.name,
        text: JSON.stringify(config),
        // input: 'text',
        // inputValue: '',
        showCancelButton: false,
        inputValidator: (value) => {
          if (!value) {
            return 'You need to provide config name!'
          }
        }
      });
    },
    showBalancesTable: function(uniqueName) {
      get(`balances/${ uniqueName }`, (err, res) => {
        if(err) {
          alert(err);
        }
        this.selectedKey = uniqueName;
        this.balances = res.result;
      });
    },
    openAddApi: function() {
      this.addApiToggle = true;
    },
    removeApiKey: function(exchange) {
      if(!confirm('Are you sure you want to delete these API keys?'))
        return;

      post('removeApiKey', {exchange}, (error, response) => {
        if(error)
          return alert(error);
      });
    },
  },
  computed: {
    apiKeySets: function() {
      return this.$store.state.apiKeys
    },
    configs: function() {
      return this.$store.state.configs.reverse();
    },
  },
  watch: {
    apiKeySets: function() {
      this.addApiToggle = false;
    },
    configs: function() {
      // this.addApiToggle = false;
    }
  }
})
</script>
