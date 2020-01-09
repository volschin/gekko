<template>
  <div class="login-page grd contain view">
    <h2 class="title">Login / Register</h2>
    <div class="grd-row">
      <div class="grd-row-col-3-6 px1">
        <h3>Existing Account</h3>

          <div class="row">
            <label for="login__email">Email</label>
            <input type="text" id="login__email" class="input--block" v-model="email"/>
          </div><!-- /.row -->

          <div class="row">
            <label for="login__password">Password</label>
            <input type="password" id="login__password" class="input--block" v-model="password"/>
          </div><!-- /.row -->

          <div class="row">
            <a class="btn--primary" href='#' v-on:click.prevent='login()'>Login</a>

          </div><!-- /.row -->

      </div>
      <div class="grd-row-col-3-6 px1">
        <h3>Create Account</h3>

          <div class="row">
            <label for="login__email1">Email</label>
            <input type="text" id="login__email1" class="input--block" v-model="emailReg"/>
          </div><!-- /.row -->
          <div class="row">
            <label for="login__username1">User Name (not required)</label>
            <input type="text" id="login__username1" class="input--block" v-model="usernameReg"/>
          </div><!-- /.row -->

          <div class="row">
            <label for="login__password1">Password</label>
            <input type="password" id="login__password1" class="input--block" v-model="passwordReg"/>
          </div><!-- /.row -->

          <div class="row">
            <a class="btn--primary btn--empty" href='#' v-on:click.prevent='register()'>Register</a>

          </div><!-- /.row -->

      </div>
    </div>
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
  import initializeState from '../../store/init';

  export default {
    name: 'loginPage',
    data: () => {
      return {
        email: '',
        password: '',
        emailReg: '',
        usernameReg: '',
        passwordReg: '',
      };
    },

    methods: {
      login() {
        this.$store.dispatch('login', {
          user: {
            email: this.email,
            password: this.password,
          },
        }).then(response => {
          this.$toast({
            text: `Welcome, ${this.email}`,
            icon: 'success',
          });
          initializeState(true);
          this.$router.push('live-gekkos');
        }, error => {
          console.error('$store.dispatch(login' + error);
          if (error.response.status === 401) {
            error.response.data = 'Неверное имя пользователя или пароль. Код 401 (Unauthorized)';
          }
          this.$toast({
            text: error.response.data,
            fullText: error,
            icon: 'error',
          });
        });
      },
      register() {
        this.$store.dispatch('register', {
          user: {
            username: this.usernameReg,
            email: this.emailReg,
            password: this.passwordReg,
          },
        }).then(response => {
          this.$toast({
            text: `Welcome, ${this.emailReg}`,
            icon: 'success',
          });
          initializeState(true);
          this.$router.push('live-gekkos');
        }, error => {
          console.error('$store.dispatch(login' + error);
          this.$toast({
            text: error.response.data,
            fullText: error,
            icon: 'error',
          });
        });
      },

      authenticate(provider) {
        this.$store.dispatch('authenticate', { provider }).then(() => {
          this.$router.push('live-gekkos');
        });
      },
    },
  };
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
