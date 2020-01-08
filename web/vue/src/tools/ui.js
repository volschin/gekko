export const alert = (msg) => {
  global.alert(msg);
}
import Swal from 'sweetalert2';
import Vue from 'vue'
if (!Vue.prototype.hasOwnProperty('$toast')) {
  Vue.prototype.$toast = function(options = {}) {
    if(typeof options === 'string') {
      options = {
        text: options
      }
    }
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      // showConfirmButton: options.showConfirmButton || false,
      // timer: options.timer || 3000,
      //      timerProgressBar: options.timerProgressBar || false,
      /*onOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
      }*/
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: false,
      animation: false
    })
    Toast.fire({
      icon: options.icon,
      title: options.text,
      text: options.fullText
    })
  };
}
