//Se inicializa al cargar el DOM, gestiona el envio del formulario de acceso, validacion de campos
//la comprobacion de credenciales vs el localStorage, el inicio de desion persistente y la redireccion a la vista principal
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');

  //Si la pagina actual no tiene el formulario detiene la ejecucion
  if (!loginForm) return;

  //Manejador del evento de envio del formulario de login
  //detiene la recarga nativa del nav, captura y limpia los valores de email y pass
  //oculta errores previos, valida que ningun campo este vacio, busca coincidencias en la lista de usuarios
  //de localStorage. Si es valido, almacena la sesion activa y redirige a index.html
  loginForm.onsubmit = (e) => {
    e.preventDefault();

    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;

    if (alertBox) {
      alertBox.classList.add('d-none');
      alertBox.textContent = '';
    }

    if (!email || !password) {
      mostrarError('Por favor, completa todos los campos.');
      return;
    }

    const usuarios = JSON.parse(localStorage.getItem('pulse_users') || '[]');

    const usuarioValido = usuarios.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!usuarioValido) {
      mostrarError('Correo electrónico o contraseña incorrectos.');
      return;
    }

    localStorage.setItem('pulse_logged', 'true');
    localStorage.setItem('pulse_active_user', JSON.stringify({ 
      name: usuarioValido.name, 
      email: usuarioValido.email 
    }));

    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
      window.location.href = '../index.html';
    } else {
      window.location.href = './index.html';
    }
  };

  //Muestra al usuario los avisos de error en la interfaz
  //verifica la existencia de alertBox, inserta el mensaje y remueve la clase d-none para hacer visible
  //el contenedor de alerta
  function mostrarError(mensaje) {
    if (!alertBox) return;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
  }
});