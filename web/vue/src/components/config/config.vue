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
</template>

<script>
import apiConfigBuilder from './apiConfigBuilder.vue';
import { post, get } from '../../tools/ajax';

export default {
  components: {
    apiConfigBuilder,
  },
  data: () => {
    return {
      selectedKey: '',
      addApiToggle: false,
      balances: [],
      columns: ['free', 'locked']
    }
  },
  methods: {
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
    }
  },
  computed: {
    apiKeySets: function() {
      return this.$store.state.apiKeys
    },
  },
  watch: {
    apiKeySets: function() {
      this.addApiToggle = false;
    }
  }
}
</script>
