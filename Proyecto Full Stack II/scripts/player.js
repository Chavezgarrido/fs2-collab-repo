document.addEventListener('DOMContentLoaded', async () => {
  // Carga asíncrona del componente modular
  await loadComponent('./components/player.html', 'player-test-container');
  initPlayerControls();
});

async function loadComponent(url, containerId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const html = await response.text();
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error al cargar el componente modular:', error);
  }
}

function initPlayerControls() {
  const playBtn = document.getElementById('btn-play-main');
  const favBtn = document.getElementById('btn-favorite');
  const progressBar = document.getElementById('playback-bar');
  const currentTimeText = document.getElementById('time-current');
  const volumeBar = document.getElementById('volume-bar');
  const volumeIcon = document.getElementById('volume-icon');

  // Alternar Play / Pausa
  if (playBtn) {
    let isPlaying = true;
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.innerHTML = isPlaying 
        ? '<i class="bi bi-pause-fill fs-4 text-white"></i>' 
        : '<i class="bi bi-play-fill fs-4 text-white"></i>';
    });
  }

  // Alternar Favorito (Like)
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      const icon = favBtn.querySelector('i');
      if (icon.classList.contains('bi-heart-fill')) {
        icon.className = 'bi bi-heart text-muted-pulse fs-5';
      } else {
        icon.className = 'bi bi-heart-fill text-pulse-accent fs-5';
      }
    });
  }

  // Progreso dinámico de tiempo
  if (progressBar && currentTimeText) {
    progressBar.addEventListener('input', (e) => {
      const secs = parseInt(e.target.value);
      const min = Math.floor(secs / 60);
      const remSecs = secs % 60;
      currentTimeText.textContent = `${min}:${remSecs < 10 ? '0' : ''}${remSecs}`;
    });
  }

  // Control de volumen dinámico
  if (volumeBar && volumeIcon) {
    volumeBar.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value);
      if (vol === 0) {
        volumeIcon.className = 'bi bi-volume-mute-fill text-muted-pulse small';
      } else if (vol < 50) {
        volumeIcon.className = 'bi bi-volume-down-fill text-muted-pulse small';
      } else {
        volumeIcon.className = 'bi bi-volume-up-fill text-muted-pulse small';
      }
    });
  }
}