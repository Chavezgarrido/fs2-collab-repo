document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const alertBox = document.getElementById('register-alert');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    alertBox.classList.add('d-none');
    alertBox.textContent = '';

    if (!name || !email || !password || !confirmPassword) {
      mostrarError('Por favor, completa todos los campos.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      mostrarError('Ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 6) {
      mostrarError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      mostrarError('Las contraseñas no coinciden.');
      return;
    }

    const usuarios = JSON.parse(localStorage.getItem('pulse_users') || '[]');
    const existe = usuarios.some(u => u.email.toLowerCase() === email.toLowerCase());

    if (existe) {
      mostrarError('Este correo electrónico ya está registrado.');
      return;
    }

    const nuevoUsuario = { name, email, password };
    usuarios.push(nuevoUsuario);
    localStorage.setItem('pulse_users', JSON.stringify(usuarios));

    localStorage.setItem('pulse_active_user', JSON.stringify({ name, email }));

    window.location.href = 'login.html';
  });

  function mostrarError(mensaje) {
    if (!alertBox) return;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
  }
});