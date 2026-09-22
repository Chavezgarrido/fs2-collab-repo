window.audioPlayer = new Audio();
window.playlistActual = [];
window.indiceActual = -1;

let isAudioPlaying = false;
let isShuffle = false;
let isRepeat = false;
let volumenPrevio = 0.7;
let tiempoVirtualSegundos = 0;
let temporizadorProgreso = null;

const CARATULA_VACIA = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="%23231c36"><rect width="24" height="24" fill="%230e0b16"/><circle cx="12" cy="12" r="9" fill="%231a1528"/><circle cx="12" cy="12" r="3" fill="%230e0b16"/><circle cx="12" cy="12" r="1" fill="%23b26bff"/></svg>';

window.inicializarEstadoVacio = function () {
  detenerRelojProgreso();
  tiempoVirtualSegundos = 0;
  window.indiceActual = -1;

  const cover = document.getElementById('current-cover');
  const title = document.getElementById('current-title');
  const artist = document.getElementById('current-artist');
  const totalTime = document.getElementById('time-total');
  const currentTime = document.getElementById('time-current');
  const progressBar = document.getElementById('playback-bar');
  const fullHeader = document.getElementById('full-header-title');

  const miniCover = document.getElementById('mini-cover');
  const miniTitle = document.getElementById('mini-title');
  const miniArtist = document.getElementById('mini-artist');
  const miniFill = document.getElementById('mini-progress-fill');

  const favBtn = document.getElementById('btn-favorite');
  const btnMiniFavorite = document.getElementById('btn-mini-favorite');
  if (favBtn) favBtn.style.display = 'none';
  if (btnMiniFavorite) btnMiniFavorite.style.display = 'none';

  if (cover) cover.src = CARATULA_VACIA;
  if (title) title.textContent = 'No hay música en reproducción';
  if (artist) artist.textContent = 'Elige una canción para comenzar';
  if (totalTime) totalTime.textContent = '0:00';
  if (currentTime) currentTime.textContent = '0:00';
  if (fullHeader) fullHeader.textContent = 'En espera';

  if (miniCover) miniCover.src = CARATULA_VACIA;
  if (miniTitle) miniTitle.textContent = 'No hay música en reproducción';
  if (miniArtist) miniArtist.textContent = 'Elige una pista';
  if (miniFill) miniFill.style.width = '0%';

  if (progressBar) {
    progressBar.min = 0;
    progressBar.max = 100;
    progressBar.value = 0;
  }

  setPlayState(false);
  renderizarCola();
};

window.buscarEnItunes = async function (termino, limite = 15) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(termino)}&entity=song&limit=${limite}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();

    return (data.results || [])
      .filter(t => t.previewUrl)
      .map(t => ({
        id: t.trackId,
        titulo: t.trackName || 'Sin título',
        artista: t.artistName || 'Artista desconocido',
        album: t.collectionName || 'Álbum / Sencillo',
        caratula: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        caratulaMini: t.artworkUrl100 || '',
        audio: t.previewUrl,
        duracionRealSegundos: t.trackTimeMillis ? Math.floor(t.trackTimeMillis / 1000) : 210
      }));
  } catch (err) {
    console.error('Error en buscarEnItunes:', err);
    return [];
  }
};

window.cargarCancion = function (indice, autoPlay = true) {
  if (!window.playlistActual.length || !window.playlistActual[indice]) return;

  detenerRelojProgreso();
  tiempoVirtualSegundos = 0;
  window.indiceActual = indice;
  const cancion = window.playlistActual[window.indiceActual];

  const cover = document.getElementById('current-cover');
  const title = document.getElementById('current-title');
  const artist = document.getElementById('current-artist');
  const totalTime = document.getElementById('time-total');
  const currentTime = document.getElementById('time-current');
  const progressBar = document.getElementById('playback-bar');
  const fullHeader = document.getElementById('full-header-title');

  const miniCover = document.getElementById('mini-cover');
  const miniTitle = document.getElementById('mini-title');
  const miniArtist = document.getElementById('mini-artist');
  const miniFill = document.getElementById('mini-progress-fill');

  const favBtn = document.getElementById('btn-favorite');
  const btnMiniFavorite = document.getElementById('btn-mini-favorite');
  if (favBtn) favBtn.style.display = 'flex';
  if (btnMiniFavorite) btnMiniFavorite.style.display = 'flex';

  if (cover) cover.src = cancion.caratula;
  if (title) title.textContent = cancion.titulo;
  if (artist) artist.textContent = cancion.artista;
  if (totalTime) totalTime.textContent = window.formatearSegundos(cancion.duracionRealSegundos);
  if (currentTime) currentTime.textContent = '0:00';
  if (fullHeader) fullHeader.textContent = cancion.album;

  if (miniCover) miniCover.src = cancion.caratulaMini || cancion.caratula;
  if (miniTitle) miniTitle.textContent = cancion.titulo;
  if (miniArtist) miniArtist.textContent = cancion.artista;
  if (miniFill) miniFill.style.width = '0%';

  if (progressBar) {
    progressBar.min = 0;
    progressBar.max = cancion.duracionRealSegundos;
    progressBar.value = 0;
  }

  window.audioPlayer.src = cancion.audio;
  window.audioPlayer.load();

  if (autoPlay) {
    window.audioPlayer.play()
      .then(() => {
        setPlayState(true);
        iniciarRelojProgreso();
      })
      .catch(err => {
        console.warn('Autoplay bloqueado por el navegador:', err);
        setPlayState(false);
      });
  } else {
    setPlayState(false);
  }

  renderizarCola();
  marcarFilaActiva(window.indiceActual);
};

window.formatearSegundos = function (segundos) {
  if (isNaN(segundos) || segundos <= 0) return '0:00';
  const min = Math.floor(segundos / 60);
  const sec = Math.floor(segundos % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

function alternarPlay() {
  if (window.indiceActual === -1 || !window.audioPlayer.src) {
    return;
  }

  if (window.audioPlayer.paused) {
    window.audioPlayer.play()
      .then(() => {
        setPlayState(true);
        iniciarRelojProgreso();
      })
      .catch(err => console.error(err));
  } else {
    window.audioPlayer.pause();
    setPlayState(false);
    detenerRelojProgreso();
  }
}

function setPlayState(playing) {
  isAudioPlaying = playing;
  const playBtn = document.getElementById('btn-play-main');
  const miniPlayBtn = document.getElementById('btn-mini-play');

  if (playBtn) {
    playBtn.innerHTML = playing
      ? '<i class="bi bi-pause-fill text-black"></i>'
      : '<i class="bi bi-play-fill text-black"></i>';
  }

  if (miniPlayBtn) {
    miniPlayBtn.innerHTML = playing
      ? '<i class="bi bi-pause-fill"></i>'
      : '<i class="bi bi-play-fill"></i>';
  }
}

function iniciarRelojProgreso() {
  detenerRelojProgreso();

  temporizadorProgreso = setInterval(() => {
    const cancion = window.playlistActual[window.indiceActual];
    if (!cancion) return;

    tiempoVirtualSegundos++;

    if (tiempoVirtualSegundos >= cancion.duracionRealSegundos) {
      if (isRepeat) {
        window.cargarCancion(window.indiceActual, true);
      } else {
        siguienteCancion();
      }
      return;
    }

    const progressBar = document.getElementById('playback-bar');
    const currentTime = document.getElementById('time-current');
    const miniFill = document.getElementById('mini-progress-fill');

    if (progressBar) progressBar.value = tiempoVirtualSegundos;
    if (currentTime) currentTime.textContent = window.formatearSegundos(tiempoVirtualSegundos);

    if (miniFill && cancion.duracionRealSegundos > 0) {
      const pct = (tiempoVirtualSegundos / cancion.duracionRealSegundos) * 100;
      miniFill.style.width = `${pct}%`;
    }
  }, 1000);
}

function detenerRelojProgreso() {
  if (temporizadorProgreso) {
    clearInterval(temporizadorProgreso);
    temporizadorProgreso = null;
  }
}

function siguienteCancion() {
  if (!window.playlistActual.length || window.indiceActual === -1) return;

  let nextIndex;
  if (isShuffle) {
    nextIndex = Math.floor(Math.random() * window.playlistActual.length);
  } else {
    nextIndex = (window.indiceActual + 1) % window.playlistActual.length;
  }

  window.cargarCancion(nextIndex, true);
}

function anteriorCancion() {
  if (!window.playlistActual.length || window.indiceActual === -1) return;

  if (tiempoVirtualSegundos > 3) {
    tiempoVirtualSegundos = 0;
    window.audioPlayer.currentTime = 0;
    const progressBar = document.getElementById('playback-bar');
    const currentTime = document.getElementById('time-current');
    if (progressBar) progressBar.value = 0;
    if (currentTime) currentTime.textContent = '0:00';
    return;
  }

  const prevIndex = (window.indiceActual - 1 + window.playlistActual.length) % window.playlistActual.length;
  window.cargarCancion(prevIndex, true);
}

function renderizarCola() {
  const container = document.getElementById('queue-list-container');
  if (!container) return;

  container.innerHTML = '';

  if (window.indiceActual === -1 || !window.playlistActual.length) {
    container.innerHTML = '<p class="text-muted-pulse extra-small py-2 text-center">Fila vacía</p>';
    return;
  }

  const siguientes = window.playlistActual.slice(window.indiceActual + 1);

  if (!siguientes.length) {
    container.innerHTML = '<p class="text-muted-pulse extra-small py-2 text-center">Fin de la fila</p>';
    return;
  }

  siguientes.slice(0, 5).forEach((cancion, offset) => {
    const targetIdx = window.indiceActual + 1 + offset;
    const item = document.createElement('article');
    item.className = 'd-flex align-items-center justify-content-between py-1 px-2 queue-item cursor-pointer';
    item.innerHTML = `
      <div class="d-flex align-items-center gap-2 overflow-hidden">
        <img src="${cancion.caratulaMini}" class="queue-thumb object-fit-cover" width="34" height="34" alt="${cancion.titulo}">
        <div class="text-truncate">
          <span class="text-white extra-small fw-semibold d-block text-truncate">${cancion.titulo}</span>
          <span class="text-muted-pulse extra-small d-block text-truncate">${cancion.artista}</span>
        </div>
      </div>
      <span class="text-muted-pulse extra-small ms-2">${window.formatearSegundos(cancion.duracionRealSegundos)}</span>
    `;

    item.addEventListener('click', () => window.cargarCancion(targetIdx, true));
    container.appendChild(item);
  });
}

function marcarFilaActiva(index) {
  const filas = document.querySelectorAll('#tracks-table-body tr');
  filas.forEach(f => {
    const title = f.querySelector('.track-title');
    if (title) title.style.color = '';
  });

  const filaActiva = document.querySelector(`#tracks-table-body tr[data-index="${index}"]`);
  if (filaActiva) {
    const title = filaActiva.querySelector('.track-title');
    if (title) title.style.color = 'var(--purple-accent)';
  }
}

window.initPlayerControls = function () {
  const playBtn = document.getElementById('btn-play-main');
  const nextBtn = document.getElementById('btn-next');
  const prevBtn = document.getElementById('btn-prev');
  const shuffleBtn = document.getElementById('btn-shuffle');
  const repeatBtn = document.getElementById('btn-repeat');
  const favBtn = document.getElementById('btn-favorite');
  const progressBar = document.getElementById('playback-bar');
  const currentTime = document.getElementById('time-current');
  const volumeBar = document.getElementById('volume-bar');
  const volumeIcon = document.getElementById('volume-icon');
  const btnVolToggle = document.getElementById('btn-volume-toggle');

  const playerContainer = document.getElementById('player-test-container');
  const miniTrigger = document.getElementById('mobile-expand-trigger');
  const btnCloseFullscreen = document.getElementById('btn-close-fullscreen');
  const btnMiniPlay = document.getElementById('btn-mini-play');
  const btnMiniFavorite = document.getElementById('btn-mini-favorite');

  window.inicializarEstadoVacio();

  if (volumeBar) {
    window.audioPlayer.volume = parseInt(volumeBar.value, 10) / 100;
  }

  if (playBtn) playBtn.onclick = alternarPlay;
  if (nextBtn) nextBtn.onclick = siguienteCancion;
  if (prevBtn) prevBtn.onclick = anteriorCancion;

  if (btnMiniPlay) {
    btnMiniPlay.onclick = (e) => {
      e.stopPropagation();
      alternarPlay();
    };
  }

  if (btnMiniFavorite) {
    btnMiniFavorite.onclick = (e) => {
      e.stopPropagation();
      alternarCorazon(btnMiniFavorite);
    };
  }

  if (miniTrigger && playerContainer) {
    miniTrigger.onclick = (e) => {
      if (
        e.target.closest('#btn-mini-play') ||
        e.target.closest('#btn-mini-favorite') ||
        e.target.closest('.pulse-mini-controls')
      ) {
        return;
      }
      playerContainer.classList.add('fullscreen-active');
    };
  }

  if (btnCloseFullscreen && playerContainer) {
    btnCloseFullscreen.onclick = () => {
      playerContainer.classList.remove('fullscreen-active');
    };
  }

  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      isShuffle = !isShuffle;
      shuffleBtn.style.color = isShuffle ? 'var(--purple-accent)' : '';
    };
  }

  if (repeatBtn) {
    repeatBtn.onclick = () => {
      isRepeat = !isRepeat;
      repeatBtn.style.color = isRepeat ? 'var(--purple-accent)' : '';
    };
  }

  window.audioPlayer.onended = () => {
    window.audioPlayer.currentTime = 0;
    window.audioPlayer.play().catch(() => { });
  };

  if (progressBar) {
    progressBar.oninput = (e) => {
      if (window.indiceActual === -1) {
        progressBar.value = 0;
        return;
      }
      tiempoVirtualSegundos = parseInt(e.target.value, 10);
      if (currentTime) currentTime.textContent = window.formatearSegundos(tiempoVirtualSegundos);
      if (window.audioPlayer.duration) {
        window.audioPlayer.currentTime = tiempoVirtualSegundos % Math.floor(window.audioPlayer.duration);
      }
    };
  }

  const alternarCorazon = (btn) => {
    if (window.indiceActual === -1 || !window.playlistActual[window.indiceActual]) return;

    const cancionActual = window.playlistActual[window.indiceActual];
    const icon = btn.querySelector('i');
    
    let likedSongs = [];
    try {
      likedSongs = JSON.parse(localStorage.getItem('pulse_liked_songs') || '[]');
    } catch (e) {
      likedSongs = [];
    }

    const existeIndex = likedSongs.findIndex(s => s.id === cancionActual.id);

    if (icon.classList.contains('bi-heart-fill')) {
      icon.className = 'bi bi-heart';
      icon.style.color = '';
      likedSongs = likedSongs.filter(s => s.id !== cancionActual.id);
    } else {
      icon.className = 'bi bi-heart-fill';
      icon.style.color = 'var(--purple-accent)';
      if (existeIndex === -1) {
        likedSongs.push(cancionActual);
      }
    }

    localStorage.setItem('pulse_liked_songs', JSON.stringify(likedSongs));
  };

  if (favBtn) favBtn.onclick = () => alternarCorazon(favBtn);

  if (volumeBar && volumeIcon) {
    volumeBar.oninput = (e) => {
      const vol = parseInt(e.target.value, 10) / 100;
      window.audioPlayer.volume = vol;
      window.audioPlayer.muted = false;
      actualizarIconoVolumen(vol);
    };
  }

  if (btnVolToggle && volumeBar) {
    btnVolToggle.onclick = () => {
      if (window.audioPlayer.muted || window.audioPlayer.volume === 0) {
        window.audioPlayer.muted = false;
        window.audioPlayer.volume = volumenPrevio || 0.5;
        volumeBar.value = window.audioPlayer.volume * 100;
      } else {
        volumenPrevio = window.audioPlayer.volume;
        window.audioPlayer.muted = true;
        window.audioPlayer.volume = 0;
        volumeBar.value = 0;
      }
      actualizarIconoVolumen(window.audioPlayer.volume);
    };
  }

  function actualizarIconoVolumen(vol) {
    if (!volumeIcon) return;
    if (vol === 0 || window.audioPlayer.muted) {
      volumeIcon.className = 'bi bi-volume-mute-fill text-danger';
    } else if (vol < 0.5) {
      volumeIcon.className = 'bi bi-volume-down-fill text-muted-pulse';
    } else {
      volumeIcon.className = 'bi bi-volume-up-fill text-muted-pulse';
    }
  }
};