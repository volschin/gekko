import Vue from 'vue'
import VueAxios from 'vue-axios';
import axios from 'axios';
import { VueAuthenticate } from 'vue-authenticate'
import globalConfig from '../config.json'

Vue.use(VueAxios, axios);

const vueAuthInstance = new VueAuthenticate(Vue.prototype.$http, {
  baseUrl: globalConfig.url,
  withCredentials: true,
  tokenPath: 'token',
  logoutUrl: '/auth/logout',
  bindRequestInterceptor: function () {
    this.$http.interceptors.request.use((config) => {
      if (this.isAuthenticated()) {
        config.headers['Authorization'] = [
          this.options.tokenType, this.getToken()
        ].join(' ')
      } else {
        delete config.headers['Authorization']
      }
      return config
    })
  },

  bindResponseInterceptor: function () {
    this.$http.interceptors.response.use((response) => {
      this.setToken(response)
      return response
    })
  },
  providers: {
    github: {
      clientId: globalConfig.auth.github.clientId,
      redirectUri: `${ globalConfig.url }/auth/callback`
    },
    facebook: {
      clientId: globalConfig.auth.facebook.clientId,
      redirectUri: `${ globalConfig.url }/auth/callback`
    },
    google: {
      clientId: globalConfig.auth.google.clientId,
      redirectUri: `${ globalConfig.url }/auth/callback`
    },
    twitter: {
      clientId: globalConfig.auth.twitter.clientId,
      redirectUri: `${ globalConfig.url }/auth/callback`
    }
  }
})

export default vueAuthInstance
