document.addEventListener('DOMContentLoaded', async() => {
    await loadComponent('./components/aside.html', 'aside-container');

});

async function loadComponent(url, containerId){
    try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al cargar ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error cargando el componente:', error);
  }
}