<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const props = defineProps<{
  latitude: number
  longitude: number
  destination: { latitude: number; longitude: number; address?: string } | null
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
const eta = ref<string | null>(null)
const distance = ref<string | null>(null)
const loadingEta = ref(false)

let map: mapboxgl.Map | null = null
let deliveryMarker: mapboxgl.Marker | null = null
let destinationMarker: mapboxgl.Marker | null = null
let etaDebounce: ReturnType<typeof setTimeout> | null = null

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const fetchEta = async (originLng: number, originLat: number) => {
  if (!props.destination || !TOKEN) return

  loadingEta.value = true
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${props.destination.longitude},${props.destination.latitude}?access_token=${TOKEN}&overview=full&geometries=geojson`
    const res = await fetch(url)
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return

    const minutes = Math.ceil(route.duration / 60)
    const km = (route.distance / 1000).toFixed(1)
    eta.value = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`
    distance.value = `${km} km`

    // Draw route on map
    if (map) {
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      }

      if (map.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData(geojson)
      } else {
        map.addSource('route', { type: 'geojson', data: geojson })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#6366f1', 'line-width': 4, 'line-opacity': 0.8 },
        })
      }
    }
  } catch (err) {
    console.error('ETA fetch error:', err)
  } finally {
    loadingEta.value = false
  }
}

const initMap = () => {
  if (!mapContainer.value || !TOKEN) return

  mapboxgl.accessToken = TOKEN

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [props.longitude, props.latitude],
    zoom: 14,
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-right')

  // Delivery marker (blue truck)
  const deliveryEl = document.createElement('div')
  deliveryEl.className = 'delivery-marker-el'
  deliveryEl.innerHTML = '<i class="pi pi-truck"></i>'

  deliveryMarker = new mapboxgl.Marker({ element: deliveryEl, anchor: 'center' })
    .setLngLat([props.longitude, props.latitude])
    .addTo(map)

  // Destination marker (red pin)
  if (props.destination) {
    destinationMarker = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([props.destination.longitude, props.destination.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(props.destination.address ?? 'Destino'))
      .addTo(map)

    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([props.longitude, props.latitude])
    bounds.extend([props.destination.longitude, props.destination.latitude])
    map.fitBounds(bounds, { padding: 60 })

    map.on('load', () => fetchEta(props.longitude, props.latitude))
  }
}

// Update marker and ETA when delivery position changes (debounced)
watch(() => [props.latitude, props.longitude] as [number, number], ([lat, lng]) => {
  deliveryMarker?.setLngLat([lng, lat])
  map?.easeTo({ center: [lng, lat], duration: 800 })

  if (etaDebounce) clearTimeout(etaDebounce)
  etaDebounce = setTimeout(() => fetchEta(lng, lat), 5000)
})

onMounted(initMap)

onUnmounted(() => {
  if (etaDebounce) clearTimeout(etaDebounce)
  map?.remove()
  map = null
})
</script>

<template>
  <div class="delivery-map-wrapper">
    <!-- ETA pill -->
    <div v-if="destination" class="eta-bar">
      <div class="eta-item">
        <i class="pi pi-clock" />
        <span v-if="loadingEta" class="eta-loading">Calculando...</span>
        <span v-else-if="eta">{{ eta }}</span>
        <span v-else class="eta-loading">—</span>
      </div>
      <div v-if="distance" class="eta-item">
        <i class="pi pi-map" />
        <span>{{ distance }}</span>
      </div>
    </div>
    <div ref="mapContainer" class="delivery-map-container" />
  </div>
</template>

<style scoped>
.delivery-map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.eta-bar {
  display: flex;
  gap: 1.25rem;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 8%, white);
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 20%, white);
}

.eta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-primary, #6366f1);
}

.eta-item .pi {
  font-size: 0.875rem;
}

.eta-loading {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.delivery-map-container {
  width: 100%;
  height: 260px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border-light, #e5e7eb);
}
</style>

<style>
.delivery-marker-el {
  width: 32px;
  height: 32px;
  background: #6366f1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
  border: 2px solid #fff;
}
</style>
