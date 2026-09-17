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

const knownCities: Point[] = [
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 }, { name: 'Abuja', country: 'Nigeria', lat: 9.0765, lng: 7.3986 }, { name: 'Port Harcourt', country: 'Nigeria', lat: 4.8156, lng: 7.0498 },
  { name: 'Accra', country: 'Ghana', lat: 5.6037, lng: -0.187 }, { name: 'Abidjan', country: "Côte d’Ivoire", lat: 5.36, lng: -4.0083 }, { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219 }, { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 }, { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729 }, { name: 'Brasília', country: 'Brazil', lat: -15.7939, lng: -47.8828 }, { name: 'Salvador', country: 'Brazil', lat: -12.9777, lng: -38.5016 }, { name: 'Recife', country: 'Brazil', lat: -8.0476, lng: -34.877 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lng: 105.8342 }, { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lng: 106.6297 }, { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 }, { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 }, { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 }, { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 }, { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 }, { name: 'Miami', country: 'United States', lat: 25.7617, lng: -80.1918 }, { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 }, { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777 }, { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 }, { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
]

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const findKnown = (value: string) => knownCities.find((c) => normalize(value).includes(normalize(c.name))) || null

async function geocode(value: string): Promise<Point | null> {
  if (!value.trim()) return null
  const known = findKnown(value)
  if (known) return known
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`, { headers: { 'Accept-Language': 'en' } })
    const data = await response.json(); const item = data?.[0]
    if (!item) return null
    const parts = String(item.display_name || value).split(',').map((x) => x.trim())
    return { name: parts[0] || value, country: parts[parts.length - 1] || '', lat: Number(item.lat), lng: Number(item.lon) }
  } catch { return null }
}

function greatCircle(a: Point, b: Point, steps = 100): number[][] {
  const rad = (x: number) => (x * Math.PI) / 180, deg = (x: number) => (x * 180) / Math.PI
  const p1 = rad(a.lat), p2 = rad(b.lat), l1 = rad(a.lng), l2 = rad(b.lng)
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (!d) return [[a.lat, a.lng]]
  const points: number[][] = []
  for (let i = 0; i <= steps; i += 1) { const f = i / steps, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d); const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2); points.push([deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))]) }
  return points
}

async function roadRoute(points: Point[]): Promise<number[][] | null> {
  try { const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${points.map((p) => `${p.lng},${p.lat}`).join(';')}?overview=full&geometries=geojson`); const data = await response.json(); return data?.routes?.[0]?.geometry?.coordinates?.map((x: number[]) => [x[1], x[0]]) || null } catch { return null }
}

function nearestIndex(line: number[][], point: Point | null) { if (!point || !line.length) return 0; let best = 0, distance = Infinity; line.forEach((item, index) => { const d = (item[0] - point.lat) ** 2 + (item[1] - point.lng) ** 2; if (d < distance) { distance = d; best = index } }); return best }

function cityLabels(a: Point, b: Point, checkpoints: Point[]) {
  const line = greatCircle(a, b, 50)
  return knownCities.filter((city) => city.name !== a.name && city.name !== b.name && !checkpoints.some((p) => p.name === city.name)).map((city) => ({ city, distance: Math.min(...line.map((p) => (p[0] - city.lat) ** 2 + (p[1] - city.lng) ** 2)) })).filter((x) => x.distance < 140).sort((x, y) => x.distance - y.distance).slice(0, 7).map((x) => x.city)
}

export default function TrackingRouteMapFixed({ origin, destination, status, events }: { origin: string; destination: string; status: string; events: TrackingEvent[] }) {
  const mapElement = useRef<HTMLDivElement | null>(null), mapRef = useRef<Leaflet>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [L, setL] = useState<Leaflet>(null), [originPoint, setOriginPoint] = useState<Point | null>(findKnown(origin)), [destinationPoint, setDestinationPoint] = useState<Point | null>(findKnown(destination)), [checkpointPoints, setCheckpointPoints] = useState<Point[]>([]), [route, setRoute] = useState<number[][]>([]), [mapError, setMapError] = useState(false)
  const transportText = `${origin} ${destination} ${events.map((e) => `${e.status} ${e.description || ''}`).join(' ')}`
  const isAir = /air|plane|airport|flight|ocean|sea|ship|international/i.test(transportText), isStopped = ['processing', 'at_hub', 'exception', 'delivered'].includes(status)
  const latestCheckpoint = checkpointPoints[checkpointPoints.length - 1] || null
  const nearbyCities = useMemo(() => originPoint && destinationPoint ? cityLabels(originPoint, destinationPoint, checkpointPoints) : [], [originPoint, destinationPoint, checkpointPoints])

  useEffect(() => { let cancelled = false; (async () => { if (!originPoint) { const p = await geocode(origin); if (!cancelled && p) setOriginPoint(p) }; if (!destinationPoint) { const p = await geocode(destination); if (!cancelled && p) setDestinationPoint(p) } })(); return () => { cancelled = true } }, [origin, destination, originPoint, destinationPoint])
  useEffect(() => { let cancelled = false; (async () => { const points: Point[] = []; for (const event of events) { if (event.latitude != null && event.longitude != null) points.push({ name: event.location || 'Checkpoint', country: '', lat: Number(event.latitude), lng: Number(event.longitude) }); else { const p = await geocode(event.location || ''); if (p) points.push(p) } } if (!cancelled) setCheckpointPoints(points) })(); return () => { cancelled = true } }, [events])
  useEffect(() => { let cancelled = false; (async () => { if (!originPoint || !destinationPoint) return; const points = [originPoint, ...checkpointPoints, destinationPoint]; if (isAir) { const segments: number[][] = []; points.slice(0, -1).forEach((point, index) => { const segment = greatCircle(point, points[index + 1], 70); segments.push(...(index ? segment.slice(1) : segment)) }); if (!cancelled) setRoute(segments) } else { const road = await roadRoute(points); if (!cancelled) setRoute(road || greatCircle(originPoint, destinationPoint)) } })(); return () => { cancelled = true } }, [originPoint, destinationPoint, checkpointPoints, isAir])
  useEffect(() => { let cancelled = false; (async () => { try { const leaflet = await import('leaflet'); if (!cancelled) setL(leaflet.default || leaflet) } catch { if (!cancelled) setMapError(true) } })(); return () => { cancelled = true } }, [])

  useEffect(() => {
    if (!L || !mapElement.current || mapRef.current) return
    const map = L.map(mapElement.current, { zoomControl: true, scrollWheelZoom: false, worldCopyJump: true }); mapRef.current = map
    const primary = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }); const fallback = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }); let switched = false
    primary.on('tileerror', () => { if (!switched) { switched = true; map.removeLayer(primary); fallback.addTo(map) } }); primary.addTo(map); map.setView([20, 0], 2)
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false })); observer.observe(mapElement.current); setTimeout(() => map.invalidateSize({ pan: false }), 250)
    return () => { observer.disconnect(); map.remove(); mapRef.current = null }
  }, [L])

  useEffect(() => {
    if (!L || !mapRef.current || !originPoint || !destinationPoint || route.length < 2) return
    const map = mapRef.current, layers: Leaflet[] = []; if (timer.current) clearInterval(timer.current)
    const currentIndex = latestCheckpoint ? nearestIndex(route, latestCheckpoint) : Math.max(1, Math.floor(route.length * 0.08))
    const remaining = L.polyline(route, { color: '#8a939d', weight: 6, opacity: 0.62, lineCap: 'round' }).addTo(map), completed = L.polyline(route.slice(0, currentIndex + 1), { color: '#0057b8', weight: 6, opacity: 1, dashArray: isAir ? '12 9' : undefined, lineCap: 'round' }).addTo(map); layers.push(remaining, completed)
    const addPin = (point: Point, kind: 'origin' | 'destination' | 'checkpoint') => { const label = kind === 'origin' ? 'A' : kind === 'destination' ? 'B' : '✓'; const icon = L.divIcon({ className: 'upc-map-pin', html: `<div class="pin ${kind}"><span class="dot">${label}</span><span class="label"><b>${point.name}</b><small>${point.country}</small></span></div>`, iconSize: [190, 46], iconAnchor: [13, 40] }); return L.marker([point.lat, point.lng], { icon }).addTo(map) }
    layers.push(addPin(originPoint, 'origin'), addPin(destinationPoint, 'destination')); checkpointPoints.forEach((point) => layers.push(addPin(point, 'checkpoint')))
    nearbyCities.forEach((city) => { const icon = L.divIcon({ className: 'upc-city-label', html: `<span>${city.name}</span>`, iconSize: [130, 22], iconAnchor: [0, 11] }); layers.push(L.marker([city.lat, city.lng], { icon, interactive: false }).addTo(map)) })
    const movingIcon = L.divIcon({ className: 'upc-moving-marker', html: `<div class="moving ${isAir ? 'air' : 'ground'}"><span>${isAir ? '✈' : '●'}</span><i></i></div>`, iconSize: [52, 52], iconAnchor: [26, 26] }); const movingMarker = L.marker(route[currentIndex], { icon: movingIcon, zIndexOffset: 1000 }).addTo(map); layers.push(movingMarker)
    if (!isStopped) { let index = currentIndex; timer.current = setInterval(() => { index = index >= route.length - 1 ? currentIndex : index + 1; movingMarker.setLatLng(route[index]) }, 650) }
    map.fitBounds(L.latLngBounds([originPoint, destinationPoint, ...checkpointPoints].map((point) => [point.lat, point.lng])), { padding: [70, 70], maxZoom: 9 }); setTimeout(() => map.invalidateSize({ pan: false }), 150)
    return () => { if (timer.current) clearInterval(timer.current); layers.forEach((layer) => { try { map.removeLayer(layer) } catch {} }) }
  }, [L, originPoint, destinationPoint, checkpointPoints, route, latestCheckpoint, nearbyCities, isAir, isStopped])

  return <section className="tracker-map-card">
    <div className="map-header"><div><span className="eyebrow">LIVE SHIPMENT MAP</span><h2>{status === 'delivered' ? 'Delivered' : status === 'exception' ? 'Shipment exception' : isStopped ? 'Shipment at checkpoint' : 'Shipment in transit'}</h2><p>{latestCheckpoint ? `Last scan: ${latestCheckpoint.name}` : `${originPoint?.name || origin} → ${destinationPoint?.name || destination}`}</p></div><div className={`movement-badge ${isStopped ? 'stopped' : ''}`}><span className="pulse" />{isStopped ? 'LAST SCAN' : 'SHIPMENT MOVING'}</div></div>
    <div className="map-shell"><div ref={mapElement} className="leaflet-map" />{mapError && <div className="map-error">Map could not be loaded. Please refresh.</div>}<div className="route-summary"><span className="route-city">{originPoint?.name || origin}</span><span className="route-arrow">→</span><span className="route-city">{destinationPoint?.name || destination}</span></div><div className="map-status-card"><span className="status-dot" />{isAir ? 'Air route' : 'Ground route'}<small>{latestCheckpoint ? latestCheckpoint.name : 'Tracking live'}</small></div></div>
    <div className="map-legend"><span><i className="line completed" />Completed route</span><span><i className="line remaining" />Remaining route</span><span><i className="legend-pin" />Checkpoint</span><span>{isAir ? '✈ Aircraft movement' : '● Vehicle movement'}</span></div>
    <div className="history"><div className="history-title"><h3>Tracking history</h3><span>{events.length} scan{events.length === 1 ? '' : 's'}</span></div>{events.length ? events.slice().sort((a, b) => new Date(b.event_time || b.created_at || 0).getTime() - new Date(a.event_time || a.created_at || 0).getTime()).map((event, index) => <div className="history-item" key={event.id || index}><div className="history-marker"><span /></div><div><b>{event.status.replaceAll('_', ' ')}</b><strong>{event.location || 'Shipment facility'}</strong>{event.description && <p>{event.description}</p>}{event.event_time && <small>{new Date(event.event_time).toLocaleString()}</small>}</div></div>) : <p className="empty-history">No tracking events have been recorded yet.</p>}</div>
    <style jsx>{`.tracker-map-card{margin:24px 0;background:#fff;border:1px solid #d7dde4;border-radius:12px;overflow:hidden;box-shadow:0 8px 28px rgba(16,24,40,.10)}.map-header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:20px 22px;border-bottom:1px solid #e5e9ee}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;color:#667085}.map-header h2{margin:6px 0 3px;font-size:24px}.map-header p{margin:0;color:#667085;font-size:14px}.movement-badge{display:flex;align-items:center;gap:8px;white-space:nowrap;color:#0057b8;font-size:11px;font-weight:900;letter-spacing:.06em}.movement-badge.stopped{color:#667085}.pulse{width:9px;height:9px;border-radius:50%;background:#12b76a;box-shadow:0 0 0 5px rgba(18,183,106,.13);animation:ping 1.3s infinite}.stopped .pulse{background:#98a2b3;box-shadow:none;animation:none}.map-shell{position:relative;background:#e9eef2}.leaflet-map,.map-shell :global(.leaflet-container){height:540px;width:100%;font-family:Arial,sans-serif;background:#e9eef2}.map-shell :global(.leaflet-control-zoom){margin:14px;border:0!important;box-shadow:0 2px 10px rgba(0,0,0,.18)!important}.route-summary{position:absolute;z-index:500;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e1e5ea;border-radius:7px;padding:9px 13px;box-shadow:0 3px 15px rgba(0,0,0,.16);font-size:12px;white-space:nowrap}.route-city{font-weight:900;color:#17202a}.route-arrow{color:#667085}.map-status-card{position:absolute;z-index:500;right:14px;bottom:14px;background:#fff;border-radius:7px;padding:10px 12px;box-shadow:0 3px 15px rgba(0,0,0,.16);font-size:11px;font-weight:900;color:#344054;display:flex;align-items:center;gap:7px}.map-status-card small{color:#667085;font-weight:500;margin-left:3px}.map-shell :global(.upc-map-pin),.map-shell :global(.upc-city-label),.map-shell :global(.upc-moving-marker){background:none;border:0}.map-shell :global(.pin){display:flex;align-items:center;gap:7px;white-space:nowrap}.map-shell :global(.dot){display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#0057b8;color:#fff;font-size:11px;font-weight:900;border:2px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.35)}.map-shell :global(.destination .dot){background:#d92d20}.map-shell :global(.checkpoint .dot){width:21px;height:21px;background:#fff;color:#0057b8;border:3px solid #0057b8;font-size:10px}.map-shell :global(.label){background:#fff;border-radius:5px;padding:4px 8px;box-shadow:0 2px 9px rgba(0,0,0,.22);font-size:11px;color:#17202a}.map-shell :global(.label b){display:block}.map-shell :global(.label small){display:block;margin-top:1px;color:#667085;font-size:9px}.map-shell :global(.upc-city-label span){display:block;background:rgba(255,255,255,.9);border-radius:4px;padding:3px 6px;color:#344054;font-size:11px;font-weight:800;box-shadow:0 1px 5px rgba(0,0,0,.16)}.map-shell :global(.moving){width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#0057b8;color:#fff;border:3px solid #fff;box-shadow:0 3px 15px rgba(0,0,0,.38);position:relative;font-size:21px}.map-shell :global(.moving.air){background:#12b76a}.map-shell :global(.moving i){position:absolute;inset:-7px;border:2px solid rgba(18,183,106,.5);border-radius:50%;animation:ring 1.4s infinite}.map-shell :global(.moving.ground i){border-color:rgba(0,87,184,.45)}.map-legend{display:flex;flex-wrap:wrap;gap:17px;padding:12px 18px;border-bottom:1px solid #e5e9ee;font-size:11px;color:#475467}.line{display:inline-block;width:25px;height:4px;border-radius:4px;margin-right:6px;vertical-align:middle}.completed{background:#0057b8}.remaining{background:#8a939d}.legend-pin{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid #0057b8;background:#fff;margin-right:6px;vertical-align:-1px}.history{padding:18px 22px 22px}.history-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.history-title h3{margin:0;font-size:17px}.history-title span{font-size:11px;color:#667085}.history-item{display:grid;grid-template-columns:24px 1fr;gap:10px;position:relative;padding:8px 0}.history-item:not(:last-child):before{content:"";position:absolute;left:8px;top:25px;bottom:-8px;width:2px;background:#d0d5dd}.history-marker{position:relative;z-index:2;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid #0057b8;display:grid;place-items:center}.history-marker span{width:6px;height:6px;border-radius:50%;background:#0057b8}.history-item b{display:block;text-transform:capitalize;font-size:13px;color:#17202a}.history-item strong{display:block;margin-top:3px;font-size:12px;color:#475467}.history-item p{margin:3px 0;color:#667085;font-size:11px}.history-item small{display:block;margin-top:4px;color:#98a2b3;font-size:10px}.empty-history{color:#667085;font-size:13px}.map-error{position:absolute;z-index:900;inset:0;display:grid;place-items:center;background:rgba(244,246,248,.95);color:#b42318;font-weight:800}@keyframes ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}@keyframes ring{0%{transform:scale(.75);opacity:.9}100%{transform:scale(1.35);opacity:0}}@media(max-width:700px){.map-header{align-items:flex-start;flex-direction:column;padding:16px}.leaflet-map,.map-shell :global(.leaflet-container){height:430px}.route-summary{max-width:90%;overflow:hidden}.map-status-card{right:8px;bottom:8px}.map-legend{gap:10px}.history{padding:16px}}`}</style>
  </section>
}
