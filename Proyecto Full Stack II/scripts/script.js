document.addEventListener('DOMContentLoaded', async () => {
  // Cargar componentes si es necesario
  await loadComponent('./components/aside.html', 'aside-container');

  // Asignar el evento click a todas las tarjetas de playlist
  initPlaylistAlerts();
});

function initPlaylistAlerts() {
  const playlistCards = document.querySelectorAll('.song-card');

  playlistCards.forEach(card => {
    card.addEventListener('click', () => {
      alert('Esta sección está en proceso');
    });
  });
}

async function loadComponent(url, containerId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error al cargar ${url}`);
    const html = await response.text();
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}