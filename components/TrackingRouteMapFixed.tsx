'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type TrackingEvent = {
  id: string
  location: string | null
  status: string
  created_at?: string
  description?: string
  event_time?: string
  latitude?: number | null
  longitude?: number | null
}

type Point = { name: string; country: string; lat: number; lng: number }

type Leaflet = any

const cities: Point[] = [
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
  { name: 'Abuja', country: 'Nigeria', lat: 9.0765, lng: 7.3986 },
  { name: 'Port Harcourt', country: 'Nigeria', lat: 4.8156, lng: 7.0498 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729 },
  { name: 'Brasília', country: 'Brazil', lat: -15.7939, lng: -47.8828 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lng: 105.8342 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lng: 106.6297 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 },
  { name: 'Miami', country: 'United States', lat: 25.7617, lng: -80.1918 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777 },
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473 },
]

const normalize = (v = '') => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const findCity = (value: string) => {
  const v = normalize(value)
  return cities.find((p) => v.includes(normalize(p.name))) || null
}

async function geocode(value: string): Promise<Point | null> {
  if (!value.trim()) return null
  const known = findCity(value)
  if (known) return known
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`, { headers: { 'Accept-Language': 'en' } })
    const data = await response.json()
    const item = data?.[0]
    if (!item) return null
    return { name: String(item.display_name?.split(',')?.[0] || value), country: String(item.display_name?.split(',')?.slice(-1)?.[0] || ''), lat: Number(item.lat), lng: Number(item.lon) }
  } catch {
    return null
  }
}

function greatCircle(a: Point, b: Point, segments = 70): number[][] {
  const rad = (n: number) => n * Math.PI / 180
  const deg = (n: number) => n * 180 / Math.PI
  const p1 = rad(a.lat), l1 = rad(a.lng), p2 = rad(b.lat), l2 = rad(b.lng)
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (!d) return [[a.lat, a.lng]]
  const result: number[][] = []
  for (let i = 0; i <= segments; i++) {
    const f = i / segments
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    result.push([deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))])
  }
  return result
}

async function roadRoute(points: Point[]): Promise<number[][] | null> {
  if (points.length < 2) return null
  try {
    const coordinates = points.map((p) => `${p.lng},${p.lat}`).join(';')
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`)
    const data = await response.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    return coords?.length ? coords.map((x: number[]) => [x[1], x[0]]) : null
  } catch {
    return null
  }
}

function nearestIndex(line: number[][], point: Point | null) {
  if (!point || !line.length) return 0
  let best = 0, distance = Infinity
  line.forEach((x, i) => {
    const d = (x[0] - point.lat) ** 2 + (x[1] - point.lng) ** 2
    if (d < distance) { distance = d; best = i }
  })
  return best
}

export default function TrackingRouteMapFixed({ origin, destination, status, events }: { origin: string; destination: string; status: string; events: TrackingEvent[] }) {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Leaflet>(null)
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [L, setL] = useState<Leaflet>(null)
  const [originPoint, setOriginPoint] = useState<Point | null>(findCity(origin))
  const [destinationPoint, setDestinationPoint] = useState<Point | null>(findCity(destination))
  const [route, setRoute] = useState<number[][]>([])
  const [mapError, setMapError] = useState(false)

  const eventPoints = useMemo(() => events.map((event) => {
    if (event.latitude != null && event.longitude != null) return { name: event.location || 'Checkpoint', country: '', lat: Number(event.latitude), lng: Number(event.longitude) }
    return findCity(event.location || '')
  }).filter(Boolean) as Point[], [events])
  const latestPoint = eventPoints[eventPoints.length - 1] || null
  const modeText = `${origin} ${destination} ${events.map((e) => `${e.status} ${e.description || ''}`).join(' ')}`.toLowerCase()
  const isAir = /air|plane|airport|flight|ocean|sea|ship/.test(modeText)
  const stopped = ['processing', 'at_hub', 'exception', 'delivered'].includes(status)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!originPoint) {
        const p = await geocode(origin)
        if (!cancelled && p) setOriginPoint(p)
      }
      if (!destinationPoint) {
        const p = await geocode(destination)
        if (!cancelled && p) setDestinationPoint(p)
      }
    })()
    return () => { cancelled = true }
  }, [origin, destination, originPoint, destinationPoint])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!originPoint || !destinationPoint) return
      const routePoints = [originPoint, ...eventPoints.filter((p) => p.name !== originPoint.name && p.name !== destinationPoint.name), destinationPoint]
      if (isAir) {
        const segments = routePoints.slice(0, -1).flatMap((p, i) => {
          const segment = greatCircle(p, routePoints[i + 1])
          return i ? segment.slice(1) : segment
        })
        if (!cancelled) setRoute(segments)
      } else {
        const routed = await roadRoute(routePoints)
        if (!cancelled) setRoute(routed || greatCircle(originPoint, destinationPoint))
      }
    })()
    return () => { cancelled = true }
  }, [originPoint, destinationPoint, eventPoints, isAir])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const leaflet = await import('leaflet')
        if (!cancelled) setL(leaflet.default || leaflet)
      } catch {
        if (!cancelled) setMapError(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!L || !mapElement.current || mapRef.current) return
    try {
      const map = L.map(mapElement.current, { zoomControl: true, scrollWheelZoom: false, worldCopyJump: true, attributionControl: true })
      mapRef.current = map
      const primary = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' })
      const fallback = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' })
      let failed = false
      primary.on('tileerror', () => { if (!failed) { failed = true; map.removeLayer(primary); fallback.addTo(map) } })
      primary.addTo(map)
      map.setView([20, 0], 2)
      setTimeout(() => map.invalidateSize({ pan: false }), 100)
      const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize({ pan: false })) : null
      observer?.observe(mapElement.current)
      return () => { observer?.disconnect(); map.remove(); mapRef.current = null }
    } catch {
      setMapError(true)
    }
  }, [L])

  useEffect(() => {
    if (!L || !mapRef.current || !originPoint || !destinationPoint || route.length < 2) return
    const map = mapRef.current
    const layers: Leaflet[] = []
    if (animationRef.current) clearInterval(animationRef.current)

    const routeLine = L.polyline(route, { color: '#b8c1cc', weight: 9, opacity: 0.9 }).addTo(map)
    const progressPoint = latestPoint || originPoint
    const progressIndex = latestPoint ? nearestIndex(route, progressPoint) : Math.max(1, Math.floor(route.length * 0.08))
    const progressLine = L.polyline(route.slice(0, progressIndex + 1), { color: '#0b6bcb', weight: 6, opacity: 1, dashArray: isAir ? '12 10' : undefined }).addTo(map)
    layers.push(routeLine, progressLine)

    const marker = (point: Point, kind: string) => {
      const letter = kind === 'origin' ? 'A' : kind === 'destination' ? 'B' : '•'
      const icon = L.divIcon({ className: 'upc-place', iconSize: [230, 60], iconAnchor: [14, 50], html: `<div class="pin ${kind}"><strong>${letter}</strong><span><b>${point.name}</b>${point.country ? `<small>${point.country}</small>` : ''}<em>${kind === 'origin' ? 'ORIGIN' : kind === 'destination' ? 'DESTINATION' : 'LATEST CHECKPOINT'}</em></span></div>` })
      return L.marker([point.lat, point.lng], { icon }).addTo(map)
    }

    layers.push(marker(originPoint, 'origin'), marker(destinationPoint, 'destination'))
    eventPoints.forEach((point) => {
      if (point.name !== originPoint.name && point.name !== destinationPoint.name) layers.push(marker(point, 'checkpoint'))
    })

    const vehicle = L.marker(route[Math.max(0, progressIndex)], { icon: L.divIcon({ className: 'upc-vehicle', iconSize: [46, 46], iconAnchor: [23, 23], html: `<div class="vehicle">${isAir ? '✈' : '●'}</div>` }) }).addTo(map)
    layers.push(vehicle)
    if (!stopped && route.length > 2) {
      let index = Math.max(1, progressIndex)
      animationRef.current = setInterval(() => { index = index >= route.length - 1 ? Math.max(1, progressIndex) : index + 1; vehicle.setLatLng(route[index]) }, 900)
    }

    const allPoints = [originPoint, destinationPoint, ...eventPoints]
    map.fitBounds(L.latLngBounds(allPoints.map((p) => [p.lat, p.lng])), { padding: [95, 95], maxZoom: allPoints.length > 2 ? 9 : 7 })
    setTimeout(() => map.invalidateSize({ pan: false }), 100)

    return () => { if (animationRef.current) clearInterval(animationRef.current); layers.forEach((layer) => { try { map.removeLayer(layer) } catch {} }) }
  }, [L, route, originPoint, destinationPoint, eventPoints, latestPoint, stopped, isAir])

  return <section className="tracker-card">
    <div className="summary"><div><span className="eyebrow">SHIPMENT JOURNEY</span><h2>{status === 'delivered' ? 'Delivered' : status === 'exception' ? 'Shipment exception' : stopped ? 'At checkpoint' : 'In transit'}</h2><p>{latestPoint ? `Latest scan: ${latestPoint.name}.` : `From ${originPoint?.name || origin} to ${destinationPoint?.name || destination}.`}</p></div><span className={`pill ${stopped ? 'hold' : 'moving'}`}>{stopped ? '● LAST SCAN' : '● SHIPMENT MOVING'}</span></div>
    <div className="map-shell">
      <div className="map-title"><div><b>Shipment route</b><span>{isAir ? 'Air route' : 'Road route'} · checkpoints and shipment progress</span></div><div className="legend"><i className="blue" /> Completed <i className="gray" /> Remaining</div></div>
      <div ref={mapElement} className="real-map" />
      {mapError && <div className="map-warning">The map service is temporarily unavailable. Refresh the page to reload the route map.</div>}
      <div className="map-overlay"><span><b>{originPoint?.name || origin}</b><small>Origin</small></span><strong>→</strong><span><b>{destinationPoint?.name || destination}</b><small>Destination</small></span></div>
    </div>
    {!stopped && <div className="live-strip"><span className="pulse" /><b>IN TRANSIT</b><span>Shipment progress toward <strong>{destinationPoint?.name || destination}</strong></span></div>}
    <div className="timeline"><h3>Tracking history</h3>{events.length ? events.slice().sort((a, b) => new Date(b.event_time || b.created_at || 0).getTime() - new Date(a.event_time || a.created_at || 0).getTime()).map((event, i) => <div className="event" key={event.id || i}><div className="event-dot" /><div><b>{event.status.replaceAll('_', ' ')}</b><span>{event.location || 'Shipment facility'}</span>{event.event_time && <small>{new Date(event.event_time).toLocaleString()}</small>}{event.description && <p>{event.description}</p>}</div></div>) : <div className="empty">No tracking events have been recorded yet.</div>}</div>
    <style jsx>{`.tracker-card{margin-top:18px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 8px 25px #1018280b}.summary{padding:20px;display:flex;justify-content:space-between;gap:15px}.eyebrow{font-size:9px;font-weight:900;color:#667085;letter-spacing:.14em}.summary h2{margin:6px 0;font-size:21px}.summary p{margin:0;color:#667085;font-size:12px}.pill{height:max-content;padding:8px 10px;border-radius:20px;font-size:9px;font-weight:900;white-space:nowrap}.moving{color:#075eaa;background:#eaf4ff}.hold{color:#c62828;background:#ffebee}.map-shell{height:500px;position:relative;background:#e9eef3}.real-map{position:absolute;inset:0;z-index:1}.map-title,.map-warning,.map-overlay{position:absolute;z-index:1000}.map-title{top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#fff;border:1px solid #e4e7ec;border-radius:10px;box-shadow:0 4px 14px #10182818}.map-title b{display:block;font-size:12px}.map-title span{display:block;font-size:9px;font-weight:600;color:#667085;margin-top:3px}.legend{display:flex;align-items:center;gap:5px;font-size:9px;color:#667085}.legend i{display:inline-block;width:18px;height:3px;border-radius:4px}.legend .blue{background:#0b6bcb}.legend .gray{background:#b8c1cc}.map-warning{top:74px;left:12px;right:12px;padding:9px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:10px;text-align:center}.map-overlay{left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:9px 13px;background:#fff;border:1px solid #e4e7ec;border-radius:10px;box-shadow:0 4px 14px #10182818;white-space:nowrap}.map-overlay span{display:flex;flex-direction:column}.map-overlay b{font-size:10px}.map-overlay small{font-size:8px;color:#667085;margin-top:2px}.map-overlay strong{color:#0b6bcb}.live-strip{padding:9px 14px;display:flex;gap:7px;align-items:center;color:#075eaa;background:#f3f8ff;border-top:1px solid #e4e7ec;font-size:10px}.pulse{width:7px;height:7px;border-radius:50%;background:#0b6bcb;animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.25}}.timeline{padding:18px 20px 22px}.timeline h3{margin:0 0 14px;font-size:14px}.event{position:relative;display:flex;gap:11px;padding:0 0 16px 18px;border-left:1px solid #d0d5dd}.event:last-child{border-left-color:transparent}.event-dot{position:absolute;left:-5px;top:0;width:9px;height:9px;border-radius:50%;background:#0b6bcb;border:2px solid #fff;box-shadow:0 0 0 1px #0b6bcb}.event b{display:block;font-size:11px;text-transform:capitalize}.event span,.event small{display:block;margin-top:3px;color:#667085;font-size:10px}.event p{margin:4px 0 0;color:#667085;font-size:10px}.empty{font-size:11px;color:#667085}.real-map :global(.upc-place),.real-map :global(.upc-vehicle){background:transparent!important;border:0!important}.real-map :global(.pin){display:flex;align-items:center;gap:7px;filter:drop-shadow(0 2px 5px #0003)}.real-map :global(.pin>strong){display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid #0b6bcb;color:#0b6bcb;font-size:10px}.real-map :global(.pin.destination>strong){border-color:#101828;color:#101828}.real-map :global(.pin.checkpoint>strong){border-color:#0b6bcb;background:#0b6bcb;color:#fff}.real-map :global(.pin span span){display:block}.real-map :global(.pin b){display:block;font-size:10px;background:#fff;padding:3px 5px;border-radius:4px;white-space:nowrap}.real-map :global(.pin small){display:block;font-size:8px;background:#fff;padding:1px 5px;color:#667085;white-space:nowrap}.real-map :global(.pin em){display:block;font-style:normal;font-size:7px;font-weight:800;color:#0b6bcb;background:#fff;padding:1px 5px;white-space:nowrap}.real-map :global(.vehicle){width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#0b6bcb;color:#fff;border:4px solid #fff;box-shadow:0 0 0 6px #0b6bcb22;font-size:17px;animation:vehiclePulse 1.5s infinite}@keyframes vehiclePulse{50%{box-shadow:0 0 0 11px #0b6bcb08}}@media(max-width:640px){.map-shell{height:430px}.summary{padding:15px}.map-title{left:8px;right:8px}.legend{display:none}.map-overlay{max-width:calc(100% - 16px);overflow:hidden}.map-overlay b{max-width:110px;overflow:hidden;text-overflow:ellipsis}.summary h2{font-size:18px}}`}</style>
  </section>
}
