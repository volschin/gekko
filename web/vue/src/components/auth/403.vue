<template>
  <div class="login-page grd contain view">
    <h2 class="title">403</h2>
    <div class="grd-row">
      <h3>Please ask administrator to add permissions to your account!</h3>
    </div>
  </div>
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
