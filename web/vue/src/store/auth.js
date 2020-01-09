import vueAuthInstance from '../auth-service'
import jwt from 'jsonwebtoken';
import config from '../../config.json';
const userManagerEnabled = window.CONFIG.userManagerEnabled;
import { processResponse } from '../tools/ajax';
import superagent from 'superagent';
import { restPath } from '../tools/api';
import noCache from 'superagent-no-cache';

export default {
  state: {
    profile: null,
    isAuthenticated: userManagerEnabled? vueAuthInstance.isAuthenticated(): true,
    user: function(fieldName) {
      let userPayload;
      if(userManagerEnabled) {
        userPayload = jwt.decode(window.localStorage[config['authTokenName']]);
      } else {
        userPayload = { // stub
          email: "shiners.test@gmail.com",
          exp: 1974107477,
          // iat: 1573934677
          id: 777,
          role: "admin"
        }
      }
      let ret;
      if(fieldName && userPayload) {
        ret = userPayload[fieldName];
      } else {
        ret = userPayload;
      }
      return ret;
    },
    isAdmin: function() {
      const role = this.user('role');
      return role === 'admin' || role === 'host';
    },
    isGuest: function() {
      const role = this.user('role');
      return role === 'guest';
    }
  },
  getters: {
    isAdmin: () => {

    }
  },
  mutations: {
    isAuthenticated (state, payload) {
      state.isAuthenticated = payload.isAuthenticated
    },

    setProfile (state, payload) {
      state.profile = payload.profile
    }
  },

  actions: {
    login (context, payload) {
      payload = payload || {}
      return vueAuthInstance.login(payload.user, payload.requestOptions).then(res=> {
        if(res.status === 200 && res.data.success) {
          context.commit('isAuthenticated', {
            isAuthenticated: true
          });
        }
      })
    },

    register (context, payload) {
      payload = payload || {}
      return vueAuthInstance.register(payload.user, payload.requestOptions).then(res => {
        if(res.status === 200 && res.data.success) {
          context.commit('isAuthenticated', {
            isAuthenticated: true
          });
        }
      })
    },

    logout (context, payload) {
      payload = payload || {}
      return vueAuthInstance.logout(payload.requestOptions).then(function () {
        context.commit('isAuthenticated', {
          isAuthenticated: vueAuthInstance.isAuthenticated()
        })
      })
    },

    authenticate (context, payload) {
      this.$toast({
        text: `Welcome, ${this.email}`,
        icon: 'success',
      });
      payload = payload || {}
      return vueAuthInstance.authenticate(payload.provider, payload.userData, payload.requestOptions).then(function () {
        context.commit('isAuthenticated', {
          isAuthenticated: vueAuthInstance.isAuthenticated()
        })
      })
    },
    changePassword (context, payload = {}) {
      return new Promise((resolve, reject) => {
        // can't use ajax' post, coz prefix is not 'api'
        superagent
          .post('auth/changePassword')
          .use(noCache)
          .send({
            newPassword: payload.newPassword
          })
          .withCredentials()
          .end(processResponse((error, response)=> {
            if(error) {
              reject(error);
            } else {
              resolve(response);
            }
          }));

        /*return post('auth/changePassword', payload.newPassword, (error, response) => {
          if(error) {
            reject(error);
          } else {
            resolve(response);
          }
        });*/
      });
    }
  }
}
