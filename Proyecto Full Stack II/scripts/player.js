//El reproductor jaja
//encapsula variables internas exponiendo las funciones a traves de window
(function () {
  let audioElement = null;

  //Lista de canciones activas cargadas en el repro
  window.playlistActual = [];
  //Indice de la pista en repro (-1 es que no hay seleccionadas, sirve para el estado inicial sin musica)
  window.indiceActual = -1;
  let estaReproduciendo = false;

  //Inicializa el reproductor de audio y enlaza los listeners
  //crea la instancia new audio si no existe, obtiene las referencias del DOM a los botones y elementos inherentes al reproductor
  //configura los eventos oninput para el control de volumen y el avance del reproductor, asigna los listeners del motor de audio
  //(ontimeupdate y onended para controlar las pistas y su sincronizacion) y configura los botones de favoritos y abrir/cerrar el reproductor
  window.initPlayerControls = function () {
    if (!audioElement) {
      audioElement = new Audio();
    }

    const btnPlayMain = document.getElementById('btn-play-main');
    const btnMiniPlay = document.getElementById('btn-mini-play');
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const playbackBar = document.getElementById('playback-bar');
    const volumeBar = document.getElementById('volume-bar');
    const mobileExpandTrigger = document.getElementById('mobile-expand-trigger');
    const btnCloseFullscreen = document.getElementById('btn-close-fullscreen');
    const playerTestContainer = document.getElementById('player-test-container');
    const btnFavorite = document.getElementById('btn-favorite');
    const btnMiniFavorite = document.getElementById('btn-mini-favorite');

    //Botones de play y pausa para el repro principal y mini
    if (btnPlayMain) btnPlayMain.onclick = () => window.togglePlay();
    if (btnMiniPlay) {
      btnMiniPlay.onclick = (e) => {
        e.stopPropagation();
        window.togglePlay();
      };
    }

    //Navegacion entre pistas
    if (btnNext) btnNext.onclick = () => window.siguienteCancion();
    if (btnPrev) btnPrev.onclick = () => window.anteriorCancion();

    //Barra de reproduccion interactiva
    if (playbackBar) {
      playbackBar.oninput = (e) => {
        if (audioElement && audioElement.duration) {
          audioElement.currentTime = (e.target.value / 100) * audioElement.duration;
        }
      };
    }

    //Control de volumen 
    if (volumeBar) {
      volumeBar.oninput = (e) => {
        if (audioElement) audioElement.volume = e.target.value / 100;
      };
    }

    //Eventos propios del elemento Audio
    if (audioElement) {
      audioElement.ontimeupdate = () => {
        if (audioElement.duration) {
          const progreso = (audioElement.currentTime / audioElement.duration) * 100;
          if (playbackBar) playbackBar.value = progreso;

          const progressFill = document.getElementById('mini-progress-fill');
          if (progressFill) progressFill.style.width = `${progreso}%`;

          const timeCurrent = document.getElementById('time-current');
          if (timeCurrent) timeCurrent.textContent = window.formatearSegundos(audioElement.currentTime);
        }
      };

      //Al terminar la cancion actual, avanza a la siguiente
      audioElement.onended = () => window.siguienteCancion();
    }

    //Abre y cierra la vista a pantalla completa en moviles
    if (mobileExpandTrigger && playerTestContainer) {
      mobileExpandTrigger.onclick = (e) => {
        if (e.target.closest('#btn-mini-play') || e.target.closest('#btn-mini-favorite')) return;
        playerTestContainer.classList.add('fullscreen-active');
      };
    }

    if (btnCloseFullscreen && playerTestContainer) {
      btnCloseFullscreen.onclick = () => playerTestContainer.classList.remove('fullscreen-active');
    }

    //Botones de Me gusta para la version desktop y la mini
    if (btnFavorite) btnFavorite.onclick = () => alternarCorazon(btnFavorite);
    if (btnMiniFavorite) {
      btnMiniFavorite.onclick = (e) => {
        e.stopPropagation();
        alternarCorazon(btnMiniFavorite);
      };
    }
  };

  //Carga un track especifico de la playlist en el reproductor
  //valida que existan canciones, asigna la URL del audio al atributo src
  //llama a actualizarUIPlayer para actualizar metadatos en pantalla y lanza
  //la promesa play actualizando la bandera interna y los iconos a pausa
  window.cargarCancion = function (index, playDirecto = true) {
    if (!window.playlistActual || window.playlistActual.length === 0) return;

    //Si retrocede antes de 0 va al final, y si supera el fin vuelve al inicio
    if (index < 0) index = window.playlistActual.length - 1;
    if (index >= window.playlistActual.length) index = 0;

    window.indiceActual = index;
    const cancion = window.playlistActual[index];

    if (!audioElement) audioElement = new Audio();

    audioElement.src = cancion.audio;
    actualizarUIPlayer(cancion);

    if (playDirecto) {
      audioElement.play().then(() => {
        estaReproduciendo = true;
        actualizarIconosPlay(true);
      }).catch(err => console.error("Error al reproducir audio:", err));
    }
  };

  //Alterna entre los estados de reproduccion y pausa del audio
  //si no hay pista cargada reproduce la primera cancion disponible, si no esta sonando
  //llama a pause, cambia estaReproduciendo a false y actualiza los iconos. Si esta en pausa
  //ejecuta play, cambia estaReproduciendo a true y actualiza los iconos
  window.togglePlay = function () {
    if (!audioElement || window.indiceActual === -1) {
      if (window.playlistActual.length > 0) window.cargarCancion(0, true);
      return;
    }

    if (estaReproduciendo) {
      audioElement.pause();
      estaReproduciendo = false;
      actualizarIconosPlay(false);
    } else {
      audioElement.play().then(() => {
        estaReproduciendo = true;
        actualizarIconosPlay(true);
      }).catch(err => console.error("Error al reproducir audio:", err));
    }
  };

  //Avanza a la siguiente cancion de la playlist activa
  window.siguienteCancion = function () {
    if (window.playlistActual.length === 0) return;
    window.cargarCancion(window.indiceActual + 1, true);
  };

  //Retrocede a la cancion previa de la playlist activa
  window.anteriorCancion = function () {
    if (window.playlistActual.length === 0) return;
    window.cargarCancion(window.indiceActual - 1, true);
  };

  //Actualiza la informacion visual del reproductor con los metadatos del tema activo
  //actualiza los textos e imagenes del player y la vista principal, pone la duracion total y llama
  //a verificarEstadoFavorito y a renderizarColaReproduccion
  function actualizarUIPlayer(cancion) {
    const miniTitle = document.getElementById('mini-title');
    const miniArtist = document.getElementById('mini-artist');
    const miniCover = document.getElementById('mini-cover');
    const currentTitle = document.getElementById('current-title');
    const currentArtist = document.getElementById('current-artist');
    const currentCover = document.getElementById('current-cover');
    const fullHeaderTitle = document.getElementById('full-header-title');
    const timeTotal = document.getElementById('time-total');

    if (miniTitle) miniTitle.textContent = cancion.titulo;
    if (miniArtist) miniArtist.textContent = cancion.artista;
    if (miniCover && cancion.caratulaMini) miniCover.src = cancion.caratulaMini;

    if (currentTitle) currentTitle.textContent = cancion.titulo;
    if (currentArtist) currentArtist.textContent = cancion.artista;
    if (currentCover && cancion.caratula) currentCover.src = cancion.caratula;
    if (fullHeaderTitle) fullHeaderTitle.textContent = cancion.album || cancion.titulo;

    if (timeTotal) timeTotal.textContent = window.formatearSegundos(cancion.duracionRealSegundos || 210);

    verificarEstadoFavorito(cancion);
    renderizarColaReproduccion();
  }

  //Muestra los proximos temas en la lista de espera
  //extrae hasta 5 temas posteriores al indice usando slice, si no quedan mas pistas muestra el aviso de "no hay mas canciones"
  //y crea elementos clickeables para saltar directamente a otros temas
  function renderizarColaReproduccion() {
    const queueContainer = document.getElementById('queue-list-container');
    if (!queueContainer) return;

    if (!window.playlistActual || window.playlistActual.length === 0) {
      queueContainer.innerHTML = `<p class="text-muted-pulse extra-small py-2 text-center">Fila vacía</p>`;
      return;
    }

    queueContainer.innerHTML = '';
    const inicio = window.indiceActual + 1;
    const fin = Math.min(inicio + 5, window.playlistActual.length);
    const siguientes = window.playlistActual.slice(inicio, fin);

    if (siguientes.length === 0) {
      queueContainer.innerHTML = `<p class="text-muted-pulse extra-small py-2 text-center">No hay más canciones</p>`;
      return;
    }

    siguientes.forEach((track, offset) => {
      const realIndex = inicio + offset;
      const div = document.createElement('div');
      div.className = 'd-flex align-items-center gap-2 p-1 cursor-pointer track-row';
      div.style.borderRadius = '4px';
      div.innerHTML = `
        <img src="${track.caratulaMini}" width="32" height="32" class="object-fit-cover rounded-0" alt="${track.titulo}">
        <div class="overflow-hidden" style="line-height: 1.2; flex-grow: 1;">
          <span class="d-block text-white extra-small fw-semibold text-truncate">${track.titulo}</span>
          <span class="d-block text-muted-pulse" style="font-size: 0.65rem;">${track.artista}</span>
        </div>
      `;
      div.onclick = () => window.cargarCancion(realIndex, true);
      queueContainer.appendChild(div);
    });
  }

  //Alterna el icono de play y pausa en los botones de la interfaz segun el estado del audio
  function actualizarIconosPlay(reproduciendo) {
    const btnPlayMain = document.getElementById('btn-play-main');
    const btnMiniPlay = document.getElementById('btn-mini-play');

    if (btnPlayMain) {
      btnPlayMain.innerHTML = reproduciendo ? '<i class="bi bi-pause-fill text-black"></i>' : '<i class="bi bi-play-fill text-black"></i>';
    }
    if (btnMiniPlay) {
      btnMiniPlay.innerHTML = reproduciendo ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
    }
  }

  //Consulta el endpoint de busqueda de la API para obtener las vistas previas de canciones
  //hace un get a la API con fetch, filtra los resultados que cuentan con previewUrl y mapea la respuesta a un modelo uniforme
  window.buscarEnItunes = async function (termino, limite = 15) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(termino)}&entity=song&limit=${limite}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al conectar con iTunes');
      const data = await res.json();

      return (data.results || []).filter(t => t.previewUrl).map(t => ({
        id: t.trackId,
        titulo: t.trackName || 'Sin título',
        artista: t.artistName || 'Artista desconocido',
        album: t.collectionName || 'Álbum / Sencillo',
        caratula: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        caratulaMini: t.artworkUrl100 || '',
        audio: t.previewUrl,
        duracionRealSegundos: t.trackTimeMillis ? Math.floor(t.trackTimeMillis / 1000) : 210
      }));
    } catch (e) {
      console.error('Error en buscarEnItunes:', e);
      return [];
    }
  };

  //Transforma una cantidad de segundos al formato estandar de minutos:segundos
  window.formatearSegundos = function (segundos) {
    if (isNaN(segundos) || segundos <= 0) return "0:00";
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  //Alterna el estado de me gusta de la pista actual y lo sincroniza con el localStorage
  //obtiene la lista actual de canciones favoritas, si ya estaba marcado como favorito, cambia el icono a vacio y lo saca de la lista
  //si no estaba marcado, llena el corazon y añade la cancion a la lista, y guarda la lista actualizada en formato JSON
  function alternarCorazon(btn) {
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
      if (existeIndex === -1) likedSongs.push(cancionActual);
    }

    localStorage.setItem('pulse_liked_songs', JSON.stringify(likedSongs));
  }


  //Comprueba si la cancion que acaba de cargarse esta guardada en favoritos
  //consulta la lista de localStorage, si el ID coincide con alguna almacenada,
  //la marca y en caso contrario lo mantiene vacio
  function verificarEstadoFavorito(cancion) {
    let likedSongs = [];
    try {
      likedSongs = JSON.parse(localStorage.getItem('pulse_liked_songs') || '[]');
    } catch (e) {
      likedSongs = [];
    }

    const esFavorita = likedSongs.some(s => s.id === cancion.id);
    const btnsCorazon = [document.getElementById('btn-favorite'), document.getElementById('btn-mini-favorite')];

    btnsCorazon.forEach(btn => {
      if (!btn) return;
      const icon = btn.querySelector('i');
      if (icon) {
        if (esFavorita) {
          icon.className = 'bi bi-heart-fill';
          icon.style.color = 'var(--purple-accent)';
        } else {
          icon.className = 'bi bi-heart';
          icon.style.color = '';
        }
      }
    });
  }
})();