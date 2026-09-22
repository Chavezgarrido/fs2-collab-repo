let contenidoInicioOriginal = '';

document.addEventListener('DOMContentLoaded', async () => {
  const main = document.querySelector('main');
  if (main) {
    contenidoInicioOriginal = main.innerHTML;
  }

  const asideCargado = await loadComponent('components/aside.html', 'aside-container');
  const playerCargado = await loadComponent('components/player.html', 'player-test-container');

  if (!asideCargado) {
    console.error('Error: No se pudo inyectar el Aside.');
  }
  if (!playerCargado) {
    console.error('Error: No se pudo inyectar el Player.');
  }

  if (typeof window.initPlayerControls === 'function') {
    window.initPlayerControls();
  }

  renderizarSaludoUsuario();
  initMainInteractions();

  await cargarGenero('Billboard Hot 100', 15, false);
});

function renderizarSaludoUsuario() {
  const container = document.getElementById('user-welcome-container');
  if (!container) return;

  let nombreUsuario = null;

  const rawActiveUser = localStorage.getItem('pulse_active_user') || sessionStorage.getItem('pulse_active_user');
  if (rawActiveUser) {
    try {
      const parsed = JSON.parse(rawActiveUser);
      nombreUsuario = parsed.name || parsed.nombre;
    } catch (e) {}
  }

  if (!nombreUsuario) {
    const posiblesClaves = ['nombreUsuario', 'userName', 'usuarioActivo', 'nombre'];
    for (const clave of posiblesClaves) {
      const valor = localStorage.getItem(clave) || sessionStorage.getItem(clave);
      if (valor && valor.trim() !== '') {
        nombreUsuario = valor;
        break;
      }
    }
  }

  if (nombreUsuario) {
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 px-3 py-1 rounded-0 border border-dark-subtle" style="background-color: var(--bg-card);">
        <i class="bi bi-person-circle fs-5" style="color: var(--purple-accent);"></i>
        <span class="text-white extra-small fw-semibold text-truncate" style="max-width: 140px;">Hola, ${nombreUsuario}</span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <a href="login.html" class="btn btn-outline-secondary text-white btn-sm rounded-0 px-3 extra-small fw-semibold">
        <i class="bi bi-box-arrow-in-right me-1"></i> Entrar
      </a>
    `;
  }
}

async function loadComponent(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[loadComponent] Contenedor #${containerId} inexistente en index.html`);
    return false;
  }

  const cacheBuster = `?t=${Date.now()}`;
  const rutas = [
    `./${url}${cacheBuster}`,
    `/${url}${cacheBuster}`,
    `${url}${cacheBuster}`,
    `../${url}${cacheBuster}`
  ];

  for (const r of rutas) {
    try {
      const res = await fetch(r);
      if (res.ok) {
        const html = await res.text();
        
        container.innerHTML = html;
        container.classList.remove('d-none');
        return true;
      }
    } catch (e) {}
  }

  console.error(`[loadComponent] Error 404: No se pudo cargar "${url}".`);
  return false;
}

async function buscarCancionesPorArtista(nombreArtista, limite = 30) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(nombreArtista)}&media=music&entity=song&attribute=artistTerm&limit=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al consultar artista');
    const data = await res.json();

    const artistaBuscadoNorm = nombreArtista.trim().toLowerCase();

    return (data.results || [])
      .filter(t => {
        if (!t.previewUrl || !t.artistName) return false;
        const nombreEnTrack = t.artistName.trim().toLowerCase();

        return nombreEnTrack === artistaBuscadoNorm || 
               nombreEnTrack.startsWith(artistaBuscadoNorm + ' &') ||
               nombreEnTrack.startsWith(artistaBuscadoNorm + ' feat') ||
               nombreEnTrack.startsWith(artistaBuscadoNorm + ' /');
      })
      .slice(0, limite)
      .map(t => ({
        id: t.trackId,
        titulo: t.trackName || 'Sin título',
        artista: t.artistName || nombreArtista,
        album: t.collectionName || 'Álbum / Sencillo',
        caratula: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        caratulaMini: t.artworkUrl100 || '',
        audio: t.previewUrl,
        duracionRealSegundos: t.trackTimeMillis ? Math.floor(t.trackTimeMillis / 1000) : 210
      }));
  } catch (err) {
    console.error('Error en buscarCancionesPorArtista:', err);
    return [];
  }
}

async function cargarGenero(termino, limite = 15, autoPlay = true) {
  const tbody = document.getElementById('tracks-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted-pulse">Cargando pistas de iTunes...</td></tr>`;
  }

  const canciones = await window.buscarEnItunes(termino, limite);
  if (canciones.length > 0) {
    window.playlistActual = canciones;
    renderizarTabla(canciones);
    
    if (autoPlay) {
      window.cargarCancion(0, true);
    }
  } else if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted-pulse">No se encontraron resultados para "${termino}"</td></tr>`;
  }
}

async function abrirVistaPodcasts() {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Volver al Inicio
      </button>
    </header>

    <section class="p-4 mb-4 rounded-0 position-relative overflow-hidden text-white" style="background: linear-gradient(135deg, #121d2e 0%, #080d16 100%); border: 1px solid #1c2536;">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge rounded-pill bg-primary px-2 py-1 extra-small"><i class="bi bi-mic-fill"></i> PODCASTS & CHARLAS</span>
        <span class="text-uppercase fw-bold extra-small text-muted-pulse" style="letter-spacing: 1px;">Pulse Talks</span>
      </div>
      <h2 class="fw-bold display-6 mb-1">Entrevistas y Cultura Musical</h2>
      <p class="text-white-50 mb-3" style="max-width: 540px;">Conoce los secretos detrás de tus bandas favoritas, historias de estudio y debates de la industria.</p>
    </section>

    <section class="mb-5">
      <h5 class="text-white fw-bold mb-3">Programas Destacados</h5>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-3">
        <div class="col">
          <div class="song-card h-100 podcast-category cursor-pointer" data-podcast="Music Interview">
            <img src="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=400&q=80" class="img-fluid mb-2 w-100 object-fit-cover" style="height: 130px;" alt="Entrevistas">
            <span class="play-btn-overlay"><i class="bi bi-play-fill fs-5"></i></span>
            <h6 class="text-white fw-bold mb-0 text-truncate">Backstage Stories</h6>
            <span class="text-muted-pulse extra-small">Charlas con artistas</span>
          </div>
        </div>
        <div class="col">
          <div class="song-card h-100 podcast-category cursor-pointer" data-podcast="Rock History">
            <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=400&q=80" class="img-fluid mb-2 w-100 object-fit-cover" style="height: 130px;" alt="Historia">
            <span class="play-btn-overlay"><i class="bi bi-play-fill fs-5"></i></span>
            <h6 class="text-white fw-bold mb-0 text-truncate">Leyendas del Rock</h6>
            <span class="text-muted-pulse extra-small">Anatomía de un disco</span>
          </div>
        </div>
        <div class="col">
          <div class="song-card h-100 podcast-category cursor-pointer" data-podcast="Pop Culture">
            <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80" class="img-fluid mb-2 w-100 object-fit-cover" style="height: 130px;" alt="Cultura Pop">
            <span class="play-btn-overlay"><i class="bi bi-play-fill fs-5"></i></span>
            <h6 class="text-white fw-bold mb-0 text-truncate">Pop Sessions</h6>
            <span class="text-muted-pulse extra-small">Tendencias globales</span>
          </div>
        </div>
        <div class="col">
          <div class="song-card h-100 podcast-category cursor-pointer" data-podcast="Tech Music">
            <img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80" class="img-fluid mb-2 w-100 object-fit-cover" style="height: 130px;" alt="Tecnología">
            <span class="play-btn-overlay"><i class="bi bi-play-fill fs-5"></i></span>
            <h6 class="text-white fw-bold mb-0 text-truncate">Future Sound</h6>
            <span class="text-muted-pulse extra-small">Innovación y audio</span>
          </div>
        </div>
      </div>
    </section>

    <section class="mb-4">
      <h5 class="text-white fw-bold mb-3">Episodios Disponibles</h5>
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <thead>
            <tr class="text-muted-pulse extra-small border-bottom border-dark-subtle">
              <th scope="col" style="width: 40px;">#</th>
              <th scope="col">EPISODIO / TÍTULO</th>
              <th scope="col">PROGRAMA</th>
              <th scope="col" class="text-end" style="width: 80px;"><i class="bi bi-clock"></i></th>
            </tr>
          </thead>
          <tbody id="tracks-table-body"></tbody>
        </table>
      </div>
    </section>
  `;

  conectarEventoBuscador();
  const btnVolver = document.getElementById('btn-volver-inicio');
  if (btnVolver) btnVolver.onclick = restaurarVistaInicio;

  await cargarGenero('Music Interview', 15, false);

  document.querySelectorAll('.podcast-category').forEach(card => {
    card.onclick = () => {
      const termino = card.getAttribute('data-podcast');
      if (termino) cargarGenero(termino, 15, true);
    };
  });
}

async function abrirVistaMeGusta() {
  const main = document.querySelector('main');
  if (!main) return;

  let likedSongs = [];
  try {
    likedSongs = JSON.parse(localStorage.getItem('pulse_liked_songs') || '[]');
  } catch (e) {
    likedSongs = [];
  }

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Volver al Inicio
      </button>
    </header>

    <section class="p-4 mb-4 rounded-0 position-relative overflow-hidden text-white" style="background: linear-gradient(135deg, #2e122b 0%, #160815 100%); border: 1px solid #361c32;">
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge rounded-pill bg-danger px-2 py-1 extra-small"><i class="bi bi-heart-fill"></i> BIBLIOTECA PERSONAL</span>
        <span class="text-uppercase fw-bold extra-small text-muted-pulse" style="letter-spacing: 1px;">Tus Favoritas</span>
      </div>
      <h2 class="fw-bold display-6 mb-1">Tus Me Gusta</h2>
      <p class="text-white-50 mb-3" style="max-width: 540px;">Todas las canciones que has marcado con ❤️ guardadas en tu dispositivo.</p>
    </section>

    <section class="mb-4">
      <h5 class="text-white fw-bold mb-3">Lista de Reproducción (${likedSongs.length} canciones)</h5>
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <thead>
            <tr class="text-muted-pulse extra-small border-bottom border-dark-subtle">
              <th scope="col" style="width: 40px;">#</th>
              <th scope="col">TÍTULO</th>
              <th scope="col" class="text-end" style="width: 80px;"><i class="bi bi-clock"></i></th>
            </tr>
          </thead>
          <tbody id="tracks-table-body"></tbody>
        </table>
      </div>
    </section>
  `;

  conectarEventoBuscador();
  const btnVolver = document.getElementById('btn-volver-inicio');
  if (btnVolver) btnVolver.onclick = restaurarVistaInicio;

  if (likedSongs.length > 0) {
    window.playlistActual = likedSongs;
    renderizarTabla(likedSongs);
  } else {
    const tbody = document.getElementById('tracks-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted-pulse">Aún no tienes canciones en "Tus Me Gusta". Dale al corazón ❤️ en cualquier pista para guardarla aquí.</td></tr>`;
    }
  }
}

function renderizarTabla(canciones) {
  const tbody = document.getElementById('tracks-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  canciones.forEach((cancion, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'track-row cursor-pointer';
    tr.dataset.index = idx;
    tr.innerHTML = `
      <td class="text-muted-pulse">${idx + 1}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <img src="${cancion.caratulaMini}" width="36" height="36" class="object-fit-cover rounded-0" alt="${cancion.titulo}">
          <div class="text-truncate" style="max-width: 220px;">
            <span class="d-block text-white fw-semibold text-truncate track-title">${cancion.titulo}</span>
            <span class="d-block text-muted-pulse extra-small text-truncate">${cancion.artista}</span>
          </div>
        </div>
      </td>
      <td class="text-muted-pulse text-truncate d-none d-sm-table-cell" style="max-width: 180px;">${cancion.album}</td>
      <td class="text-end text-muted-pulse extra-small">${window.formatearSegundos(cancion.duracionRealSegundos)}</td>
    `;
    tr.onclick = () => window.cargarCancion(idx, true);
    tbody.appendChild(tr);
  });
}

async function consultarDatosBusqueda(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al consultar iTunes');
    const data = await res.json();

    const raw = data.results || [];
    if (raw.length === 0) return null;

    const queryNorm = query.trim().toLowerCase();

    const artistasMap = new Map();
    raw.forEach(item => {
      if (item.artistName && !artistasMap.has(item.artistName.toLowerCase())) {
        artistasMap.set(item.artistName.toLowerCase(), {
          nombre: item.artistName,
          genero: item.primaryGenreName || 'Banda / Artista',
          foto: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : ''
        });
      }
    });

    let artistas = Array.from(artistasMap.values());
    artistas.sort((a, b) => {
      const aExacto = a.nombre.toLowerCase() === queryNorm ? -1 : 1;
      const bExacto = b.nombre.toLowerCase() === queryNorm ? -1 : 1;
      return aExacto - bExacto;
    });
    artistas = artistas.slice(0, 4);

    const canciones = raw
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

    const albumesMap = new Map();
    raw.forEach(item => {
      if (item.collectionName && !albumesMap.has(item.collectionName.toLowerCase())) {
        albumesMap.set(item.collectionName.toLowerCase(), {
          titulo: item.collectionName,
          artista: item.artistName,
          caratula: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : ''
        });
      }
    });
    const albumes = Array.from(albumesMap.values()).slice(0, 4);

    return { artistas, canciones, albumes };
  } catch (error) {
    console.error('Error en consultarDatosBusqueda:', error);
    return null;
  }
}

async function verPerfilBanda(nombreBanda, fotoBanda, generoBanda) {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex align-items-center mb-4">
      <div class="input-group" style="max-width: 460px;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
    </header>
    <div class="text-center py-5">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <p class="text-muted-pulse">Filtrando discografía exclusiva de ${nombreBanda}...</p>
    </div>
  `;
  conectarEventoBuscador();

  let canciones = await buscarCancionesPorArtista(nombreBanda, 35);
  if (!canciones || canciones.length === 0) {
    canciones = await window.buscarEnItunes(nombreBanda, 25);
  }

  window.playlistActual = canciones;
  const fotoBanner = fotoBanda || (canciones[0] ? canciones[0].caratula : '');

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-atras" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Volver al Inicio
      </button>
    </header>

    <section class="p-3 p-md-4 mb-4 rounded-0 d-flex flex-column flex-sm-row align-items-center gap-3 gap-md-4" 
             style="background: linear-gradient(135deg, #1d122e 0%, #0c0816 100%); border: 1px solid #231c36;">
      <img src="${fotoBanner}" class="rounded-circle object-fit-cover shadow-lg border border-secondary flex-shrink-0" style="width: 120px; height: 120px;" alt="${nombreBanda}">
      <div class="text-center text-sm-start">
        <span class="text-uppercase fw-bold extra-small text-muted-pulse mb-1 d-block">Banda / Artista Verificado</span>
        <h1 class="text-white fw-bold fs-2 fs-md-1 mb-2">${nombreBanda}</h1>
        <p class="text-muted-pulse extra-small mb-3 text-uppercase">${generoBanda || 'Rock'} • ${canciones.length} temas oficiales</p>
        <button id="btn-play-all-banda" class="btn text-white fw-bold px-4 py-2 rounded-0 d-inline-flex align-items-center gap-2" style="background-color: var(--purple-accent);">
          <i class="bi bi-play-fill fs-5"></i> Reproducir Todo
        </button>
      </div>
    </section>

    <section class="mb-4">
      <h5 class="text-white fw-bold mb-3">Canciones de ${nombreBanda}</h5>
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <thead>
            <tr class="text-muted-pulse extra-small border-bottom border-dark-subtle">
              <th scope="col" style="width: 30px;">#</th>
              <th scope="col">TÍTULO</th>
              <th scope="col" class="d-none d-sm-table-cell">ÁLBUM</th>
              <th scope="col" class="text-end" style="width: 60px;"><i class="bi bi-clock"></i></th>
            </tr>
          </thead>
          <tbody id="tracks-table-body"></tbody>
        </table>
      </div>
    </section>
  `;

  renderizarTabla(canciones);
  conectarEventoBuscador();
  main.scrollTop = 0;

  const btnPlayAll = document.getElementById('btn-play-all-banda');
  if (btnPlayAll) btnPlayAll.onclick = () => window.cargarCancion(0, true);

  const btnVolver = document.getElementById('btn-volver-atras');
  if (btnVolver) btnVolver.onclick = restaurarVistaInicio;
}

async function ejecutarBusquedaPagina(query) {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex align-items-center mb-4">
      <div class="input-group" style="max-width: 460px;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
      </div>
    </header>
    <div class="text-center py-5">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <p class="text-muted-pulse">Buscando resultados para "${query}"...</p>
    </div>
  `;

  conectarEventoBuscador();
  const resultados = await consultarDatosBusqueda(query);

  if (!resultados || resultados.canciones.length === 0) {
    main.innerHTML = `
      <header class="d-flex align-items-center mb-4">
        <div class="input-group" style="max-width: 460px;">
          <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
            <i class="bi bi-search"></i>
          </span>
          <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
        </div>
      </header>

      <div class="d-flex flex-column align-items-center justify-content-center py-5 text-center my-5">
        <div class="p-3 rounded-circle mb-3" style="background-color: var(--bg-card); width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;">
          <i class="bi bi-search fs-2 text-muted-pulse"></i>
        </div>
        <h4 class="text-white fw-bold mb-2">No se encontraron resultados para "${query}"</h4>
        <p class="text-muted-pulse mb-4" style="max-width: 440px;">
          No encontramos bandas, canciones ni álbumes con ese nombre.
        </p>
        <button id="btn-volver-inicio" class="btn text-white rounded-0 px-4 py-2 fw-semibold" style="background-color: var(--purple-accent);">
          <i class="bi bi-house-door me-2"></i>Volver al Inicio
        </button>
      </div>
    `;

    conectarEventoBuscador();
    const btnVolver = document.getElementById('btn-volver-inicio');
    if (btnVolver) btnVolver.onclick = restaurarVistaInicio;
    return;
  }

  window.playlistActual = resultados.canciones;

  let artistasHTML = '';
  resultados.artistas.forEach(art => {
    artistasHTML += `
      <div class="col">
        <div class="song-card h-100 p-3 artist-card cursor-pointer" data-artist="${art.nombre}" data-photo="${art.foto}" data-genre="${art.genero}">
          <img src="${art.foto}" class="img-fluid rounded-circle mb-2 mx-auto d-block object-fit-cover shadow" style="width: 90px; height: 90px;" alt="${art.nombre}">
          <h6 class="text-white fw-bold mb-1 text-center text-truncate">${art.nombre}</h6>
          <span class="text-muted-pulse extra-small d-block text-center text-uppercase">${art.genero}</span>
        </div>
      </div>
    `;
  });

  let albumesHTML = '';
  resultados.albumes.forEach(alb => {
    albumesHTML += `
      <div class="col">
        <div class="song-card h-100 album-card cursor-pointer" data-album="${alb.titulo}">
          <img src="${alb.caratula}" class="img-fluid mb-2 w-100 object-fit-cover" style="height: 120px;" alt="${alb.titulo}">
          <span class="play-btn-overlay"><i class="bi bi-play-fill fs-5"></i></span>
          <h6 class="text-white fw-bold mb-0 text-truncate">${alb.titulo}</h6>
          <span class="text-muted-pulse extra-small d-block text-truncate">${alb.artista}</span>
        </div>
      </div>
    `;
  });

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0">
          <i class="bi bi-search"></i>
        </span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Volver al Inicio
      </button>
    </header>

    <div class="mb-4">
      <span class="text-uppercase fw-bold extra-small text-muted-pulse mb-1 d-block" style="letter-spacing: 1px;">Explorador</span>
      <h3 class="text-white fw-bold fs-4 fs-md-3">Resultados para "${query}"</h3>
    </div>

    ${resultados.artistas.length > 0 ? `
      <section class="mb-4 mb-md-5">
        <h5 class="text-white fw-bold mb-3">Bandas y Artistas <span class="text-muted-pulse extra-small fw-normal">(Toca para abrir sus temas)</span></h5>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2 g-md-3">
          ${artistasHTML}
        </div>
      </section>
    ` : ''}

    <section class="mb-4 mb-md-5">
      <h5 class="text-white fw-bold mb-3">Canciones</h5>
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <thead>
            <tr class="text-muted-pulse extra-small border-bottom border-dark-subtle">
              <th scope="col" style="width: 30px;">#</th>
              <th scope="col">TÍTULO</th>
              <th scope="col" class="d-none d-sm-table-cell">ÁLBUM</th>
              <th scope="col" class="text-end" style="width: 60px;"><i class="bi bi-clock"></i></th>
            </tr>
          </thead>
          <tbody id="tracks-table-body"></tbody>
        </table>
      </div>
    </section>

    ${resultados.albumes.length > 0 ? `
      <section class="mb-4">
        <h5 class="text-white fw-bold mb-3">Álbumes y Compilaciones</h5>
        <div class="row row-cols-2 row-cols-md-4 g-2 g-md-3">
          ${albumesHTML}
        </div>
      </section>
    ` : ''}
  `;

  renderizarTabla(resultados.canciones);
  conectarEventoBuscador();

  const btnVolver = document.getElementById('btn-volver-inicio');
  if (btnVolver) btnVolver.onclick = restaurarVistaInicio;
}

function restaurarVistaInicio() {
  const main = document.querySelector('main');
  if (!main || !contenidoInicioOriginal) return;

  main.innerHTML = contenidoInicioOriginal;
  renderizarSaludoUsuario();
  initMainInteractions();
  cargarGenero('Billboard Hot 100', 15, false);
}

function conectarEventoBuscador() {
  const searchInput = document.getElementById('main-search-input') || document.querySelector('input.search-input');
  if (searchInput) {
    searchInput.focus();
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q.length > 0) ejecutarBusquedaPagina(q);
      }
    };
  }
}

function initMainInteractions() {
  const searchInput = document.getElementById('main-search-input') || document.querySelector('input.search-input');
  const playlistCards = document.querySelectorAll('.song-card');
  const quickCards = document.querySelectorAll('.quick-card');
  const heroBtn = document.getElementById('btn-hero-play');

  if (searchInput) {
    let timer;
    searchInput.oninput = (e) => {
      clearTimeout(timer);
      const q = e.target.value.trim();
      if (q.length > 2) timer = setTimeout(() => cargarGenero(q, 15, false), 450);
    };

    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        const q = searchInput.value.trim();
        if (q.length > 0) ejecutarBusquedaPagina(q);
      }
    };
  }

  playlistCards.forEach(card => {
    card.onclick = () => {
      const g = card.getAttribute('data-genre') || card.querySelector('h6')?.textContent.trim();
      if (g) cargarGenero(g, 15, true);
    };
  });

  quickCards.forEach(card => {
    card.onclick = () => {
      const g = card.querySelector('span')?.textContent.trim();
      if (g) cargarGenero(g, 15, true);
    };
  });

  if (heroBtn) {
    heroBtn.onclick = () => cargarGenero('Pop Rock Essentials', 15, true);
  }
}

document.addEventListener('click', (e) => {
  const cardBanda = e.target.closest('.artist-card');
  if (cardBanda) {
    const nombre = cardBanda.getAttribute('data-artist');
    const foto = cardBanda.getAttribute('data-photo');
    const genero = cardBanda.getAttribute('data-genre');
    if (nombre) verPerfilBanda(nombre, foto, genero);
    return;
  }

  const cardAlbum = e.target.closest('.album-card');
  if (cardAlbum) {
    const alb = cardAlbum.getAttribute('data-album');
    if (alb) cargarGenero(alb, 25, true);
    return;
  }

  const navItem = e.target.closest('.nav-link-pulse');
  if (navItem) {
    e.preventDefault();
    document.querySelectorAll('.nav-link-pulse').forEach(el => el.classList.remove('active'));
    navItem.classList.add('active');
    
    const texto = navItem.textContent.trim().toLowerCase();
    if (texto.includes('inicio')) {
      restaurarVistaInicio();
    } else if (texto.includes('explorar')) {
      const generosVariados = [
        'Rock Alternativo', 
        'Electronic Dance', 
        'Indie Rock', 
        'Jazz Essentials', 
        'Latin Pop', 
        'Hip Hop Hits', 
        'Soul & R&B', 
        'Classic Hits'
      ];
      const generoAleatorio = generosVariados[Math.floor(Math.random() * generosVariados.length)];
      ejecutarBusquedaPagina(generoAleatorio);
    } else if (texto.includes('radio')) {
      abrirVistaPodcasts();
    } else if (texto.includes('biblioteca') || texto.includes('tu biblioteca')) {
      abrirVistaMeGusta();
    }
    return;
  }

  const itemAside = e.target.closest('.sidebar-playlist-item a');
  if (itemAside) {
    e.preventDefault();
    cargarGenero(itemAside.textContent.trim(), 15, true);
  }

  const itemBibliotecaMeGusta = e.target.closest('.sidebar-item');
  if (itemBibliotecaMeGusta && itemBibliotecaMeGusta.textContent.includes('Tus Me Gusta')) {
    e.preventDefault();
    abrirVistaMeGusta();
  }
});