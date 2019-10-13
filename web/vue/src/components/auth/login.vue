<template>
<div class="login-page">
  <h1 class="title">Login to existing account</h1>

<form @submit.prevent="login()" class="form form--login grid">

  <div class="row">
  <label for="login__email">Email</label>
  <input type="text" id="login__email" class="input--block" v-model="email" />
  </div><!-- /.row -->

  <div class="row">
  <label for="login__password">Password</label>
  <input type="password" id="login__password" class="input--block" v-model="password" />
  </div><!-- /.row -->

  <div class="row">
  <button type="submit">Login</button>
  </div><!-- /.row -->

  </form>

  <!--<div class="row social-buttons">
  <h4 class="title title&#45;&#45;small">Login using OAuth provider</h4>

  <button type="button" @click="authenticate('github')" class="social&#45;&#45;github">Github</button>
  <button type="button" @click="authenticate('facebook')" class="social&#45;&#45;facebook">Facebook</button>
  <button type="button" @click="authenticate('google')" class="social&#45;&#45;google">Google</button>
  <button type="button" @click="authenticate('twitter')" class="social&#45;&#45;twitter">Twitter</button>
  &lt;!&ndash; <button type="button" @click="authenticate('instagram')" class="social&#45;&#45;instagram">Instagram</button> &ndash;&gt;
  &lt;!&ndash; <button type="button" @click="authenticate('bitbucket')" class="social&#45;&#45;bitbucket">BitBucket</button> &ndash;&gt;
  </div>&lt;!&ndash; /.row social-buttons &ndash;&gt;-->

<div class="row">
<!--  Don't have account? <router-link :to="{ name: 'register' }">Register</router-link> one now!-->
</div><!-- /.row -->

</div><!-- /.login-page -->
</template>

<script>
export default {
  name: 'loginPage',
  data: () => {
    return {
      email: '',
      password: ''
    }
  },

  methods: {
    login () {
      window.store = this.$store;
      this.$store.dispatch('login', {
        user: {
          email: this.email,
          password: this.password
        }
      }).then(response => {
        this.$router.push('live-gekkos')
      }, error => {
        console.error('$store.dispatch(login' + error);
      })
    },

    authenticate (provider) {
      this.$store.dispatch('authenticate', { provider }).then(() => {
        this.$router.push('live-gekkos')
      })
    }
  }
}
</script>

<style lang="scss">
.login-page {
.social-buttons {
    margin: 3rem 0;
    text-align: center;

    button {
      margin: 0 .25rem;
      margin-bottom: .25rem;
    }
  }
}
</style>
