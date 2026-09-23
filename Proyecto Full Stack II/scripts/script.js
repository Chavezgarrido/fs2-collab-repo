//Variable global para que guardemos el HTML inicial y restaurarlo con el botón al volver al inicio
let contenidoInicioOriginal = '';


//Evento que se ejecuta una vez que el navegador termina de cargar el DOM. Configura el estado inicial
//de la app: guarda la vista de inicio, arranca controles globales, saluda al usuario y precarga canciones.
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (main) {
    contenidoInicioOriginal = main.innerHTML;
  }


  //Inicializa los controles del reproductor si existen (botones de play, pausa y la barra de progreso)
  if (typeof window.initPlayerControls === 'function') {
    window.initPlayerControls();
  }

  renderizarSaludoUsuario();
  initGlobalInteractions();


  //Carga inicial de canciones
  cargarGenero('Billboard Hot 100', 15, false);
});


//Gestiona el estado de sesion visual en la interfaz.
//Busca los datos del usuario en el storage local o de sesión, si encuentra un usuario autenticado, renderiza
//un boton con su nombre que enlaza a la vista del perfil. Si no hay sesión activa muestra el botón para redirigir al login
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


  //Si no esta en formato JSON, busca en alternativas de almacenamiento
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
      <div id="btn-abrir-perfil" class="d-flex align-items-center gap-2 px-3 py-1 rounded-0 border border-dark-subtle cursor-pointer" style="background-color: var(--bg-card);" title="Ver Perfil y Suscripción">
        <i class="bi bi-person-circle fs-5" style="color: var(--purple-accent);"></i>
        <span class="text-white extra-small fw-semibold text-truncate" style="max-width: 140px;">Hola, ${nombreUsuario}</span>
      </div>
    `;
    const btnPerfil = document.getElementById('btn-abrir-perfil');
    if (btnPerfil) btnPerfil.onclick = abrirVistaPerfil;
  } else {
    container.innerHTML = `
      <a href="login.html" class="btn btn-outline-secondary text-white btn-sm rounded-0 px-3 extra-small fw-semibold">
        <i class="bi bi-box-arrow-in-right me-1"></i> Entrar
      </a>
    `;
  }
}

//Consulta la API de música para obtener temas de un artista concreto
//Llama al endpoint pidiendo hasta 100 registros, aplica un filtro de texto para garantizar que el
//artista coincida con la busqueda y normaliza las propiedades (id, titulo, caratula, duracion)
async function buscarCancionesPorArtista(nombreArtista, limite = 35) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(nombreArtista)}&entity=song&limit=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al consultar artista');
    const data = await res.json();
    
    const artistaBuscadoNorm = nombreArtista.trim().toLowerCase();

    //filtro estricto para asegurar que el nombre del artista contenga al texto
    let resultadosFiltrados = (data.results || []).filter(t => {
      if (!t.previewUrl || !t.artistName) return false;
      const nombreEnTrack = t.artistName.trim().toLowerCase();
      return nombreEnTrack.includes(artistaBuscadoNorm) || artistaBuscadoNorm.includes(nombreEnTrack);
    });


    //si el filtro estricto descarta todo, se usan los resultados generales de la API
    if (resultadosFiltrados.length === 0) {
      resultadosFiltrados = data.results || [];
    }

    return resultadosFiltrados.slice(0, limite).map(t => ({
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

//Busca canciones por etiqueta o genero y las muestra en la tabla principal.
//muestra un estado visual de carga, invoca la funcion global para buscar en la API 
//y actualiza la playlist actual, dibuja las filas e inicia la reproducción
async function cargarGenero(termino, limite = 15, autoPlay = true) {
  const tbody = document.getElementById('tracks-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted-pulse">Cargando pistas para "${termino}"...</td></tr>`;
  }

  if (typeof window.buscarEnItunes === 'function') {
    let canciones = await window.buscarEnItunes(termino, limite);
    
    // Si la búsqueda es muy específica (como un artista), filtramos para asegurar calidad
    if (canciones.length > 0) {
      window.playlistActual = canciones;
      renderizarTabla(canciones);
      
      if (autoPlay && typeof window.cargarCancion === 'function') {
        window.cargarCancion(0, true);
      }
    } else if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted-pulse">No se encontraron resultados para "${termino}"</td></tr>`;
    }
  }
}

//Genera dinamicamente las filas dentro de la tabla de canciones
//limpia el contenido del elemento tracks-table-body, recorre el arreglo creando un elemento por cada canción
//y asigna a cada fila un evento onclick que invoca cargarCancion
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
      <td class="text-end text-muted-pulse extra-small">${typeof window.formatearSegundos === 'function' ? window.formatearSegundos(cancion.duracionRealSegundos) : '3:30'}</td>
    `;
    tr.onclick = () => {
      if (typeof window.cargarCancion === 'function') {
        window.cargarCancion(idx, true);
      }
    };
    tbody.appendChild(tr);
  });
}

//Motor de busqueda global que categoriza resultados en canciones, artistas y albumes
//realiza una busqueda inicial priorizando artistas, si hay menos de 5 resultados
//lanza una busqueda general para complementar, usa estructuras Map para deduplicar artistas
//y aplica ordenamiento de relevancia para poner primero las coincidencias exactas con el termino buscado
async function consultarDatosBusqueda(query) {
  try {
    // Intentamos primero buscar específicamente por artista (attribute=artistTerm)
    let urlArtista = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&attribute=artistTerm&limit=50`;
    let res = await fetch(urlArtista);
    let data = await res.json();
    let raw = data.results || [];

    // Si no hay suficientes resultados por artista estricto, hacemos búsqueda general en paralelo
    if (raw.length < 5) {
      const urlGeneral = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`;
      const resGen = await fetch(urlGeneral);
      const dataGen = await resGen.json();
      raw = [...raw, ...(dataGen.results || [])];
    }

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
      const aMatch = a.nombre.toLowerCase().includes(queryNorm) ? -1 : 1;
      const bMatch = b.nombre.toLowerCase().includes(queryNorm) ? -1 : 1;
      return aMatch - bMatch;
    });
    artistas = artistas.slice(0, 4);

    // Priorizar canciones cuyo artista coincida con la consulta
    const cancionesMap = new Map();
    raw.forEach(t => {
      if (!t.previewUrl) return;
      const trackObj = {
        id: t.trackId,
        titulo: t.trackName || 'Sin título',
        artista: t.artistName || 'Artista desconocido',
        album: t.collectionName || 'Álbum / Sencillo',
        caratula: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        caratulaMini: t.artworkUrl100 || '',
        audio: t.previewUrl,
        duracionRealSegundos: t.trackTimeMillis ? Math.floor(t.trackTimeMillis / 1000) : 210
      };
      cancionesMap.set(t.trackId, trackObj);
    });

    let canciones = Array.from(cancionesMap.values());
    // Ordenar para poner primero las canciones donde el nombre del artista coincida exactamente con la búsqueda
    canciones.sort((a, b) => {
      const aEsArtista = a.artista.toLowerCase().includes(queryNorm) ? -1 : 1;
      const bEsArtista = b.artista.toLowerCase().includes(queryNorm) ? -1 : 1;
      return aEsArtista - bEsArtista;
    });

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

//Renderiza la vista completa de resultados de busqueda dentro de main
//reemplaza el contenido con un indicador de carga, llama a consultarDatosBusqueda. 
//si no hay resultados, muestra un mensaje de vacio, si hay coincidencias construye tres canciones
//grid de tarjetas de artistas, tabla de canciones y grid de albumes asociados
async function ejecutarBusquedaPagina(query) {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>
    <div class="text-center py-5">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <p class="text-muted-pulse">Buscando resultados para "${query}"...</p>
    </div>
  `;

  const resultados = await consultarDatosBusqueda(query);
  if (!resultados || resultados.canciones.length === 0) {
    main.innerHTML = `
      <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div class="input-group" style="max-width: 460px; flex-grow: 1;">
          <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
          <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
        </div>
        <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
      </header>
      <div class="d-flex flex-column align-items-center justify-content-center py-5 text-center my-5">
        <h4 class="text-white fw-bold mb-2">No se encontraron resultados para "${query}"</h4>
      </div>
    `;
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
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes..." value="${query}">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>

    <div class="mb-4">
      <span class="text-uppercase fw-bold extra-small text-muted-pulse mb-1 d-block" style="letter-spacing: 1px;">Explorador</span>
      <h3 class="text-white fw-bold fs-4 fs-md-3">Resultados para "${query}"</h3>
    </div>

    ${resultados.artistas.length > 0 ? `
      <section class="mb-4 mb-md-5">
        <h5 class="text-white fw-bold mb-3">Bandas y Artistas</h5>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2 g-md-3">${artistasHTML}</div>
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
        <div class="row row-cols-2 row-cols-md-4 g-2 g-md-3">${albumesHTML}</div>
      </section>
    ` : ''}
  `;

  renderizarTabla(resultados.canciones);
  main.scrollTop = 0;
}

//Construye y presenta la vista dedicada a un artista o banda especifica
//muestra un estado de carga mientras filtra la discografia, si falla o no hay datos, recurre a un respaldo
//renderiza un encabezado tipo banner con los datos del artista y un boton para reproducir todo
//y muestra el listado completo de canciones en una tabla interactiva
async function verPerfilBanda(nombreBanda, fotoBanda, generoBanda) {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-atras" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>
    <div class="text-center py-5">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <p class="text-muted-pulse">Filtrando discografía de ${nombreBanda}...</p>
    </div>
  `;

  let canciones = await buscarCancionesPorArtista(nombreBanda, 35);
  if (!canciones || canciones.length === 0) {
    canciones = await window.buscarEnItunes(nombreBanda, 25);
  }

  window.playlistActual = canciones;
  const fotoBanner = fotoBanda || (canciones[0] ? canciones[0].caratula : '');

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-atras" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>

    <section class="p-3 p-md-4 mb-4 rounded-0 d-flex flex-column flex-sm-row align-items-center gap-3 gap-md-4" style="background: linear-gradient(135deg, #1d122e 0%, #0c0816 100%); border: 1px solid #231c36;">
      <img src="${fotoBanner}" class="rounded-circle object-fit-cover shadow-lg border border-secondary flex-shrink-0" style="width: 120px; height: 120px;" alt="${nombreBanda}">
      <div class="text-center text-sm-start">
        <span class="text-uppercase fw-bold extra-small text-muted-pulse mb-1 d-block">Banda / Artista Verificado</span>
        <h1 class="text-white fw-bold fs-2 fs-md-1 mb-2">${nombreBanda}</h1>
        <p class="text-muted-pulse extra-small mb-3 text-uppercase">${generoBanda || 'Jazz Fusion'} • ${canciones.length} temas oficiales</p>
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
  main.scrollTop = 0;
  const btnPlayAll = document.getElementById('btn-play-all-banda');
  if (btnPlayAll) btnPlayAll.onclick = () => window.cargarCancion(0, true);
}

//Renderiza el panel de usuario, con suscripciones y pasarela de pago
//lee la info del usuario y su estado de suscripcion desde el localStorage, muestra los planes e incorpora
//logica para abrir pasarela de pago, procesar el pago simulado y cancelar la suscripcion si ya esta activa
function abrirVistaPerfil() {
  const main = document.querySelector('main');
  if (!main) return;

  let usuarioData = { name: 'Usuario', email: 'correo@pulse.cl' };
  try {
    const raw = localStorage.getItem('pulse_active_user');
    if (raw) usuarioData = JSON.parse(raw);
  } catch (e) {}

  const esSuscrito = localStorage.getItem('pulse_premium') === 'true';
  const fechaRegistro = localStorage.getItem('pulse_reg_date') || 'Marzo 2026';
  const fechaRenovacion = '23 de Abril de 2027';

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>

    <section class="p-4 mb-4 rounded-0 position-relative overflow-hidden text-white" style="background: linear-gradient(135deg, #1d122e 0%, #0c0816 100%); border: 1px solid #231c36;">
      <div class="d-flex flex-column flex-sm-row align-items-center gap-4">
        <div class="rounded-circle d-flex align-items-center justify-content-center fs-1 text-white fw-bold shadow flex-shrink-0" style="width: 80px; height: 80px; background-color: var(--purple-accent);">
          ${(usuarioData.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div class="text-center text-sm-start flex-grow-1">
          <h2 class="fw-bold mb-1">${usuarioData.name || 'Usuario Pulse'}</h2>
          <p class="text-muted-pulse mb-2">${usuarioData.email || 'Sin correo asociado'}</p>
          <div class="d-flex flex-wrap justify-content-center justify-content-sm-start align-items-center gap-2">
            <span class="badge rounded-0 px-2.5 py-1 text-uppercase extra-small ${esSuscrito ? 'bg-success' : 'bg-secondary'}">
              ${esSuscrito ? '✨ Miembro Pulse Premium Activo' : 'Cuenta Pulse Free'}
            </span>
            <span class="text-muted-pulse extra-small">• Miembro desde ${fechaRegistro}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- DETALLES DE PLANES -->
    <section class="mb-5">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="text-white fw-bold mb-0">Planes y Membresías Pulse</h5>
        <span class="text-muted-pulse extra-small">Facturación segura en pesos chilenos (CLP)</span>
      </div>

      <div class="row row-cols-1 row-cols-md-2 g-3 mb-4">
        <div class="col">
          <div class="card h-100 bg-card border border-dark-subtle rounded-0 p-4 text-white" style="background-color: var(--bg-card) !important;">
            <span class="text-uppercase fw-bold extra-small text-muted-pulse mb-1">Experiencia Estándar</span>
            <h4 class="fw-bold mb-2">Pulse Free</h4>
            <p class="text-muted-pulse extra-small mb-3">Disfruta de música con anuncios ocasionales y funciones esenciales.</p>
            <ul class="text-muted-pulse extra-small ps-3 mb-4 d-flex flex-column gap-2">
              <li>Reproducción con breves anuncios</li>
              <li>Calidad de sonido estándar (128 kbps)</li>
              <li>Saltos de pista limitados a 6 por hora</li>
              <li>Acceso completo a radios y podcasts</li>
            </ul>
            <h3 class="fw-bold mb-4">$0 <span class="fs-6 text-muted-pulse fw-normal">/ mes</span></h3>
            <button class="btn btn-outline-light rounded-0 w-100 mt-auto" ${!esSuscrito ? 'disabled' : ''}>
              ${!esSuscrito ? 'Tu Plan Actual' : 'Cambiar a Free'}
            </button>
          </div>
        </div>

        <div class="col">
          <div class="card h-100 bg-card border rounded-0 p-4 text-white" style="background-color: var(--bg-card) !important; border-color: var(--purple-accent) !important;">
            <span class="text-uppercase fw-bold extra-small mb-1" style="color: var(--purple-accent);">Máxima Calidad Sin Límites</span>
            <h4 class="fw-bold mb-2">Pulse Premium</h4>
            <p class="text-white-50 extra-small mb-3">Música en alta fidelidad sin interrupciones y descargas ilimitadas.</p>
            <ul class="text-white-50 extra-small ps-3 mb-4 d-flex flex-column gap-2">
              <li><strong class="text-white">Cero anuncios</strong> musicales o comerciales</li>
              <li><strong class="text-white">Audio Lossless</strong> de alta fidelidad</li>
              <li><strong class="text-white">Descargas offline</strong> ilimitadas en tus dispositivos</li>
              <li><strong class="text-white">Saltos infinitos</strong> y reproducción en el orden que desees</li>
              ${esSuscrito ? `<li class="text-success">Renovación automática programada para el ${fechaRenovacion}</li>` : ''}
            </ul>
            <h3 class="fw-bold mb-4">$4.990 <span class="fs-6 text-muted-pulse fw-normal">/ mes</span></h3>
            <button id="btn-iniciar-pago" class="btn text-white fw-bold rounded-0 w-100 mt-auto" style="background-color: var(--purple-accent);">
              ${esSuscrito ? 'Administrar o Cancelar Suscripción' : 'Suscribirme a Pulse Premium'}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- PASARELA DE PAGO INTERACTIVA -->
    <div id="checkout-steps-container" class="d-none p-4 rounded-0 mb-5 text-white" style="background-color: var(--bg-card); border: 1px solid var(--purple-accent);">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="fw-bold mb-0"><i class="bi bi-shield-lock-fill me-2" style="color: var(--purple-accent);"></i> Pasarela de Pago Segura - Pulse Premium</h5>
        <button id="btn-cerrar-checkout" class="btn btn-sm btn-outline-secondary text-white rounded-0"><i class="bi bi-x-lg"></i></button>
      </div>

      <p class="text-muted-pulse extra-small mb-4">Estás a un paso de activar todas las funciones avanzadas. Selecciona tu método de pago preferido:</p>

      <div class="row g-3 mb-4">
        <div class="col-md-6">
          <label class="p-3 border border-secondary cursor-pointer d-flex align-items-center gap-3 w-100 h-100" style="background: rgba(255,255,255,0.02);">
            <input type="radio" name="payment-method" checked>
            <div>
              <span class="d-block fw-bold text-white">Tarjeta de Crédito / Débito</span>
              <span class="text-muted-pulse extra-small">Visa, Mastercard, Redcompra</span>
            </div>
          </label>
        </div>
        <div class="col-md-6">
          <label class="p-3 border border-secondary cursor-pointer d-flex align-items-center gap-3 w-100 h-100" style="background: rgba(255,255,255,0.02);">
            <input type="radio" name="payment-method">
            <div>
              <span class="d-block fw-bold text-white">Mercado Pago / PayPal</span>
              <span class="text-muted-pulse extra-small">Pago rápido y seguro online</span>
            </div>
          </label>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label text-muted-pulse extra-small">Número de Tarjeta (Simulado)</label>
        <input type="text" class="form-control search-input rounded-0" value="4532 8810 9921 4410">
      </div>
      <div class="row g-2 mb-4">
        <div class="col-6">
          <label class="form-label text-muted-pulse extra-small">Expiración</label>
          <input type="text" class="form-control search-input rounded-0" value="08/28">
        </div>
        <div class="col-6">
          <label class="form-label text-muted-pulse extra-small">CVV</label>
          <input type="password" class="form-control search-input rounded-0" value="382">
        </div>
      </div>

      <button id="btn-procesar-pago-final" class="btn text-white fw-bold rounded-0 w-100 py-2.5" style="background-color: var(--purple-accent);">
        Autorizar Cobro de $4.990 / mes e Iniciar Suscripción
      </button>
    </div>
  `;

  const btnIniciarPago = document.getElementById('btn-iniciar-pago');
  const checkoutContainer = document.getElementById('checkout-steps-container');
  const btnCerrarCheckout = document.getElementById('btn-cerrar-checkout');
  const btnProcesarPagoFinal = document.getElementById('btn-procesar-pago-final');

  if (btnIniciarPago && checkoutContainer) {
    btnIniciarPago.onclick = () => {
      if (esSuscrito) {
        if (confirm('¿Estás seguro de que deseas cancelar tu suscripción Pulse Premium? Perderás el acceso al audio Lossless y descargas al finalizar el periodo actual.')) {
          localStorage.setItem('pulse_premium', 'false');
          alert('Tu suscripción ha sido cancelada exitosamente.');
          abrirVistaPerfil();
        }
      } else {
        checkoutContainer.classList.remove('d-none');
        checkoutContainer.scrollIntoView({ behavior: 'smooth' });
      }
    };
  }

  if (btnCerrarCheckout && checkoutContainer) {
    btnCerrarCheckout.onclick = () => checkoutContainer.classList.add('d-none');
  }

  if (btnProcesarPagoFinal) {
    btnProcesarPagoFinal.onclick = () => {
      localStorage.setItem('pulse_premium', 'true');
      localStorage.setItem('pulse_reg_date', 'Marzo 2026');
      alert('¡Pago procesado con éxito! Bienvenido a Pulse Premium.');
      abrirVistaPerfil();
    };
  }
}

//Carga y presenta la seccion de podcasts en main
//renderiza la estructura basica de la seccion de podcast con su banner
//llama a cargarGenero para tener los episodios por la API
async function abrirVistaPodcasts() {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="input-group" style="max-width: 460px; flex-grow: 1;">
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>

    <section class="p-4 mb-4 rounded-0 position-relative overflow-hidden text-white" style="background: linear-gradient(135deg, #121d2e 0%, #080d16 100%); border: 1px solid #1c2536;">
      <h2 class="fw-bold display-6 mb-1">Podcasts y Charlas</h2>
    </section>

    <section class="mb-4">
      <h5 class="text-white fw-bold mb-3">Episodios Disponibles</h5>
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <tbody id="tracks-table-body"></tbody>
        </table>
      </div>
    </section>
  `;

  await cargarGenero('Music Interview', 15, false);
}

//Despliega la lista de canciones guardadas por el usuario en localStorage
//recupera el JSON almacenado, si no hay canciones guardadas muestra un mensaje
//si existen canciones asigna la lista y construye la tabla con opcion de reproduccion al hacer click
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
        <span class="input-group-text search-input border-end-0 text-muted-pulse rounded-0"><i class="bi bi-search"></i></span>
        <input type="text" id="main-search-input" class="form-control search-input border-start-0 rounded-0" placeholder="Buscar canciones, bandas o álbumes...">
      </div>
      <button id="btn-volver-inicio" class="btn btn-outline-secondary text-white rounded-0 px-3 btn-sm"><i class="bi bi-arrow-left me-1"></i> Volver al Inicio</button>
    </header>

    <section class="p-4 mb-4 rounded-0 position-relative overflow-hidden text-white" style="background: linear-gradient(135deg, #2e122b 0%, #160815 100%); border: 1px solid #361c32;">
      <h2 class="fw-bold display-6 mb-1">Tus Me Gusta</h2>
    </section>

    <section class="mb-4">
      <div class="table-responsive">
        <table class="table table-dark table-borderless align-middle mb-0" style="background-color: transparent;">
          <tbody id="tracks-table-body-liked"></tbody>
        </table>
      </div>
    </section>
  `;

  const tbodyLiked = document.getElementById('tracks-table-body-liked');
  if (!tbodyLiked) return;
  tbodyLiked.innerHTML = '';

  if (likedSongs.length > 0) {
    window.playlistActual = likedSongs;
    likedSongs.forEach((cancion, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'track-row cursor-pointer';
      tr.dataset.index = idx;
      tr.innerHTML = `
        <td class="text-muted-pulse">${idx + 1}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <img src="${cancion.caratulaMini}" width="36" height="36" class="object-fit-cover rounded-0" alt="${cancion.titulo}">
            <div class="text-truncate" style="max-width: 280px;">
              <span class="d-block text-white fw-semibold text-truncate track-title">${cancion.titulo}</span>
              <span class="d-block text-muted-pulse extra-small text-truncate">${cancion.artista}</span>
            </div>
          </div>
        </td>
        <td class="text-end text-muted-pulse extra-small">${typeof window.formatearSegundos === 'function' ? window.formatearSegundos(cancion.duracionRealSegundos) : '3:30'}</td>
      `;
      tr.onclick = () => {
        if (typeof window.cargarCancion === 'function') window.cargarCancion(idx, true);
      };
      tbodyLiked.appendChild(tr);
    });
  } else {
    tbodyLiked.innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted-pulse">Aún no tienes canciones en "Tus Me Gusta".</td></tr>`;
  }
}

//Regresa la aplicacion a la pantalla principal sin recargar la pagina completa
//restaura el HTML original guardado al inicio de la ejecucion, vuelve a ejecutar renderizarSaludoUsuario
//y vuelve a consultar y mostrar las canciones iniciales
function restaurarVistaInicio() {
  const main = document.querySelector('main');
  if (!main || !contenidoInicioOriginal) return;

  main.innerHTML = contenidoInicioOriginal;
  renderizarSaludoUsuario();
  cargarGenero('Billboard Hot 100', 15, false);
}

//Configura los listeners globales
//detecta cuando se presiona Enter dentro de la búsqueda
//y dispara la busqueda llamando a ejecutarBusquedaPagina
function initGlobalInteractions() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const searchInput = e.target.closest('#main-search-input');
      if (searchInput) {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q.length > 0) ejecutarBusquedaPagina(q);
      }
    }
  });
}

//Controla de forma central los clicks de la interfaz, permitiendo interactuar con elementos
//sin duplicar los listeners. Tiene botones de volver al inicio o volver atrás, tarjetas de generos
//y accesos rapidos, tarjetas de artistas, enlaces del menu lateral y listas de reproduccion del aside.
document.addEventListener('click', (e) => {
  const btnVolver = e.target.closest('#btn-volver-inicio') || e.target.closest('#btn-volver-atras');
  if (btnVolver) {
    e.preventDefault();
    restaurarVistaInicio();
    return;
  }

  //Click en tarjetas de canciones del grid principal
  const songCard = e.target.closest('.song-card');
  if (songCard) {
    const rawGenre = songCard.getAttribute('data-genre');
    let terminoBusqueda = 'Rock';
    if (rawGenre) {
      terminoBusqueda = rawGenre;
    } else {
      const tituloTexto = songCard.querySelector('h6')?.textContent.trim().toLowerCase() || '';
      if (tituloTexto.includes('clásico') || tituloTexto.includes('classic')) terminoBusqueda = 'Classic Rock';
      else if (tituloTexto.includes('hits')) terminoBusqueda = 'Pop Hits';
      else if (tituloTexto.includes('pop rock')) terminoBusqueda, terminoBusqueda = 'Pop Rock';
      else if (tituloTexto.includes('80s')) terminoBusqueda = '80s Smash Hits';
    }
    cargarGenero(terminoBusqueda, 15, true);
    return;
  }

  //Click en tarjetas rapidas
  const quickCard = e.target.closest('.quick-card');
  if (quickCard) {
    const texto = quickCard.querySelector('span')?.textContent.trim() || 'Rock';
    cargarGenero(texto, 15, true);
    return;
  }

  //Click en el boton principal del hero banner
  const heroBtn = e.target.closest('#btn-hero-play');
  if (heroBtn) {
    e.preventDefault();
    cargarGenero('Pop Rock Essentials', 15, true);
    return;
  }

  //Click en tarjetas de artistas
  const cardBanda = e.target.closest('.artist-card');
  if (cardBanda) {
    const nombre = cardBanda.getAttribute('data-artist');
    const foto = cardBanda.getAttribute('data-photo');
    const genero = cardBanda.getAttribute('data-genre');
    if (nombre) verPerfilBanda(nombre, foto, genero);
    return;
  }

  //Click en tarjetas de albumes
  const cardAlbum = e.target.closest('.album-card');
  if (cardAlbum) {
    const alb = cardAlbum.getAttribute('data-album');
    if (alb) cargarGenero(alb, 25, true);
    return;
  }

  //Navegacion en el menu lateral principal
  const navItem = e.target.closest('.nav-link-pulse');
  if (navItem) {
    e.preventDefault();
    document.querySelectorAll('.nav-link-pulse').forEach(el => el.classList.remove('active'));
    navItem.classList.add('active');
    
    const texto = navItem.textContent.trim().toLowerCase();
    if (texto.includes('inicio')) {
      restaurarVistaInicio();
    } else if (texto.includes('explorar')) {
      const generosVariados = ['Rock Alternativo', 'Electronic Dance', 'Indie Rock', 'Jazz Essentials', 'Latin Pop', 'Hip Hop Hits', 'Soul & R&B', 'Classic Hits'];
      const generoAleatorio = generosVariados[Math.floor(Math.random() * generosVariados.length)];
      ejecutarBusquedaPagina(generoAleatorio);
    } else if (texto.includes('radio')) {
      abrirVistaPodcasts();
    } else if (texto.includes('biblioteca') || texto.includes('tu biblioteca')) {
      abrirVistaMeGusta();
    }
    return;
  }

  //Click en playlist del sidebar
  const itemAside = e.target.closest('.sidebar-playlist-item a');
  if (itemAside) {
    e.preventDefault();
    cargarGenero(itemAside.textContent.trim(), 15, true);
    return;
  }

  //Click directo al item de "Tus me gusta" en la barra lateral
  const itemBibliotecaMeGusta = e.target.closest('.sidebar-item');
  if (itemBibliotecaMeGusta && itemBibliotecaMeGusta.textContent.includes('Tus Me Gusta')) {
    e.preventDefault();
    abrirVistaMeGusta();
    return;
  }
});