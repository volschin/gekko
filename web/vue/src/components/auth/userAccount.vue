<template lang='pug'>
 div.user-account--component
  h3.title User Account
  p {{ userEmail }}
  div.row
    a.btn--primary(href='#', v-if='isAuthenticated', v-on:click.prevent='changePassword') Set New Password
</template>

<script>
  import initializeState from '../../store/init'

  export default {
    name: 'ChangePassword',
    data: () => {
      return {
        email: '',
        password: ''
      }
    },

    methods: {
      async changePassword () {
        const { value: formValues } = await this.$swal({
          title: 'New Password',
          html:
            '<input id="swal-input1" type="password" class="swal2-input" placeholder="password">' +
            '<span id="swal-error1" style="color: red" ></span>',
          showCancelButton: true,
          preConfirm: () => {
            const password = document.getElementById('swal-input1').value;
            if(password === '') {
              document.getElementById('swal-error1').innerText = 'Password cannot be empty!';
              return false;
            }
            if(password.length < 8) {
              document.getElementById('swal-error1').innerText = 'Password should be 8 symbols or longer!';
              return false;
            }
            return [
              password
            ]
          }
        });
        if(formValues && formValues[0]) {
          this.$store.dispatch('changePassword', {
            newPassword: formValues[0]
          }).then(response => {
            this.$toast({
              text: 'Password changed',
              icon: 'success'
            });
          }, error => {
            console.error('$store.dispatch(changePassword..): ' + error);
            this.$toast({
              text: 'Password NOT changed',
              fullText: error,
              icon: 'error'
            });
          });
        }
      },
    },
    computed: {
      userEmail () {
        return this.$store.state.auth.user && this.$store.state.auth.user() && this.$store.state.auth.user().email;
      },
      isAuthenticated () {
        return this.$store.state.auth.isAuthenticated
      },
    }
  }
</script>

<style lang="scss">
.user-account--component {

}
</style>
