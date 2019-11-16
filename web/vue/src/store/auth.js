import vueAuthInstance from '../auth-service'
import jwt from 'jsonwebtoken';
import config from '../../config.json';
const userManagerEnabled = window.CONFIG.userManagerEnabled;

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
      return vueAuthInstance.register(payload.user, payload.requestOptions).then(function () {
        context.commit('isAuthenticated', {
          isAuthenticated: vueAuthInstance.isAuthenticated()
        })
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
      payload = payload || {}
      return vueAuthInstance.authenticate(payload.provider, payload.userData, payload.requestOptions).then(function () {
        context.commit('isAuthenticated', {
          isAuthenticated: vueAuthInstance.isAuthenticated()
        })
      })
    }
  }
}
