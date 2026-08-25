import L from 'leaflet'

/**
 * Ajoute les 3 fonds de carte gratuits (aucune clé API requise) avec un
 * sélecteur Leaflet natif. Le filtre sombre (voir index.css,
 * .map-inverted) ne s'applique qu'aux tuiles "Rues" — inverser une image
 * satellite ou un fond topo coloré donnerait un résultat n'importe quoi.
 */
export function addBaseLayers(map: L.Map, container: HTMLElement): L.Control.Layers {
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  })
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
  )
  const terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap',
    maxZoom: 17,
  })

  streets.addTo(map)
  container.classList.add('map-inverted')

  const control = L.control
    .layers({ Rues: streets, Satellite: satellite, Terrain: terrain }, undefined, { position: 'topright' })
    .addTo(map)

  map.on('baselayerchange', (e: L.LayersControlEvent) => {
    container.classList.toggle('map-inverted', e.name === 'Rues')
  })

  return control
}
