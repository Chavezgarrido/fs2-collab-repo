document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');

  if (!loginForm) return;

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

  function mostrarError(mensaje) {
    if (!alertBox) return;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
  }
});