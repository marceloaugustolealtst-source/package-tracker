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
  { name:'Lagos', country:'Nigeria', lat:6.5244, lng:3.3792 }, { name:'Abuja', country:'Nigeria', lat:9.0765, lng:7.3986 }, { name:'Port Harcourt', country:'Nigeria', lat:4.8156, lng:7.0498 },
  { name:'Accra', country:'Ghana', lat:5.6037, lng:-0.187 }, { name:'Abidjan', country:"Côte d’Ivoire", lat:5.36, lng:-4.0083 }, { name:'Nairobi', country:'Kenya', lat:-1.2921, lng:36.8219 }, { name:'Johannesburg', country:'South Africa', lat:-26.2041, lng:28.0473 },
  { name:'São Paulo', country:'Brazil', lat:-23.5505, lng:-46.6333 }, { name:'Rio de Janeiro', country:'Brazil', lat:-22.9068, lng:-43.1729 }, { name:'Brasília', country:'Brazil', lat:-15.7939, lng:-47.8828 }, { name:'Salvador', country:'Brazil', lat:-12.9777, lng:-38.5016 }, { name:'Recife', country:'Brazil', lat:-8.0476, lng:-34.877 },
  { name:'Hanoi', country:'Vietnam', lat:21.0278, lng:105.8342 }, { name:'Ho Chi Minh City', country:'Vietnam', lat:10.8231, lng:106.6297 }, { name:'London', country:'United Kingdom', lat:51.5074, lng:-0.1278 }, { name:'Paris', country:'France', lat:48.8566, lng:2.3522 }, { name:'Madrid', country:'Spain', lat:40.4168, lng:-3.7038 }, { name:'Lisbon', country:'Portugal', lat:38.7223, lng:-9.1393 },
  { name:'Toronto', country:'Canada', lat:43.6532, lng:-79.3832 }, { name:'New York', country:'United States', lat:40.7128, lng:-74.006 }, { name:'Miami', country:'United States', lat:25.7617, lng:-80.1918 }, { name:'Dubai', country:'United Arab Emirates', lat:25.2048, lng:55.2708 }, { name:'Mumbai', country:'India', lat:19.076, lng:72.8777 }, { name:'Singapore', country:'Singapore', lat:1.3521, lng:103.8198 }, { name:'Tokyo', country:'Japan', lat:35.6762, lng:139.6503 }
]

const normalize = (v = '') => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const known = (v: string) => knownCities.find(c => normalize(v).includes(normalize(c.name))) || null

async function locate(value: string): Promise<Point | null> {
  if (!value.trim()) return null
  const k = known(value)
  if (k) return k
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`, { headers: { 'Accept-Language': 'en' } })
    const x = (await r.json())?.[0]
    if (!x) return null
    const parts = String(x.display_name || value).split(',').map(s => s.trim())
    return { name: parts[0] || value, country: parts.at(-1) || '', lat: Number(x.lat), lng: Number(x.lon) }
  } catch { return null }
}

function greatCircle(a: Point, b: Point, steps = 120): number[][] {
  const rad = (x:number) => x * Math.PI / 180, deg = (x:number) => x * 180 / Math.PI
  const p1=rad(a.lat), p2=rad(b.lat), l1=rad(a.lng), l2=rad(b.lng)
  const d=2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((l2-l1)/2)**2))
  if (!d) return [[a.lat,a.lng]]
  const out:number[][]=[]
  for(let i=0;i<=steps;i++) { const f=i/steps,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d),x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2),y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2),z=A*Math.sin(p1)+B*Math.sin(p2);out.push([deg(Math.atan2(z,Math.sqrt(x*x+y*y))),deg(Math.atan2(y,x))]) }
  return out
}

async function roadRoute(points: Point[]): Promise<number[][] | null> {
  try {
    const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${points.map(p=>`${p.lng},${p.lat}`).join(';')}?overview=full&geometries=geojson`)
    const x=await r.json()
    return x?.routes?.[0]?.geometry?.coordinates?.map((p:number[])=>[p[1],p[0]]) || null
  } catch { return null }
}

function distance(a:number[],b:number[]){return (a[0]-b[0])**2+(a[1]-b[1])**2}

export default function TrackingRouteMapFixed({origin,destination,status,events}:{origin:string;destination:string;status:string;events:TrackingEvent[]}) {
  const el=useRef<HTMLDivElement>(null), map=useRef<Leaflet>(null), timer=useRef<any>(null)
  const [L,setL]=useState<Leaflet>(null),[a,setA]=useState<Point|null>(known(origin)),[b,setB]=useState<Point|null>(known(destination)),[checks,setChecks]=useState<Point[]>([]),[road,setRoad]=useState<number[][]>([]),[routeCities,setRouteCities]=useState<Point[]>([])

  const text=normalize(`${origin} ${destination} ${status} ${events.map(e=>`${e.status} ${e.description||''} ${e.location||''}`).join(' ')}`)
  const isOutForDelivery=/out.?for.?delivery|delivery|last.?mile/.test(text)
  const isAir=!isOutForDelivery && /air|plane|airport|flight|airway|air.?freight/.test(text)
  const isGround=!isAir
  const isCheckpoint=/at.?hub|checkpoint|facility|arrived|processing|exception|customs|warehouse/.test(normalize(status))
  const last=checks.at(-1)||null

  useEffect(()=>{let dead=false;(async()=>{if(!a){const p=await locate(origin);if(!dead&&p)setA(p)}if(!b){const p=await locate(destination);if(!dead&&p)setB(p)}})();return()=>{dead=true}},[origin,destination,a,b])
  useEffect(()=>{let dead=false;(async()=>{const out:Point[]=[];for(const e of events){if(e.latitude!=null&&e.longitude!=null)out.push({name:e.location||'Checkpoint',country:'',lat:Number(e.latitude),lng:Number(e.longitude)});else{const p=await locate(e.location||'');if(p)out.push(p)}}if(!dead)setChecks(out)})();return()=>{dead=true}},[events])

  useEffect(()=>{let dead=false;(async()=>{if(!a||!b)return;const points=[a,...checks,b];if(isAir){setRoad([]);return}const r=await roadRoute(points);if(!dead)setRoad(r||[])})();return()=>{dead=true}},[a,b,checks,isAir])

  const route=useMemo(()=>{if(!a||!b)return [];const points=[a,...checks,b];if(isAir){const all:number[][]=[];points.slice(0,-1).forEach((p,i)=>{const seg=greatCircle(p,points[i+1],70);all.push(...(i?seg.slice(1):seg))});return all}return road.length>1?road:greatCircle(a,b)},[a,b,checks,road,isAir])

  // Prefer real city names found by the registered origin/destination; fall back to nearby known cities only when geocoding is unavailable.
  useEffect(()=>{let dead=false;(async()=>{if(!route.length||!a||!b)return;const candidates=knownCities.filter(c=>c.name!==a.name&&c.name!==b.name&&!checks.some(p=>p.name===c.name));const scored=candidates.map(c=>({c,d:Math.min(...route.map(p=>distance(p,[c.lat,c.lng])))})).filter(x=>x.d<180).sort((x,y)=>x.d-y.d).slice(0,8).map(x=>x.c);if(!dead)setRouteCities(scored)})();return()=>{dead=true}},[route,a,b,checks])

  useEffect(()=>{let dead=false;(async()=>{try{const mod=await import('leaflet');if(!dead)setL(mod.default||mod)}catch{}})();return()=>{dead=true}},[])
  useEffect(()=>{if(!L||!el.current||map.current)return;const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.upcLeaflet='1';document.head.appendChild(link);const m=L.map(el.current,{zoomControl:false,scrollWheelZoom:false,doubleClickZoom:false,worldCopyJump:true});map.current=m;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);L.control.zoom({position:'bottomright'}).addTo(m);m.setView([20,0],2);setTimeout(()=>m.invalidateSize(false),300);return()=>{m.remove();map.current=null}},[L])

  useEffect(()=>{if(!L||!map.current||!a||!b||route.length<2)return;const m=map.current,layers:Leaflet[]=[];if(timer.current)clearInterval(timer.current)
    const activePoint=last||a;let active=route.reduce((best,p,i)=>distance(p,[activePoint.lat,activePoint.lng])<distance(route[best],[activePoint.lat,activePoint.lng])?i:best,0);if(!last&&active<2)active=Math.floor(route.length*.08)
    const completed=route.slice(0,Math.max(2,active+1)),remaining=route.slice(Math.max(0,active),route.length)
    layers.push(L.polyline(route,{color:'#68717d',weight:5,opacity:.38,lineCap:'round'}).addTo(m),L.polyline(completed,{color:'#ffb81c',weight:7,opacity:1,lineCap:'round'}).addTo(m),L.polyline(remaining,{color:'#68717d',weight:4,opacity:.5,dashArray:'8 10',lineCap:'round'}).addTo(m))
    const pin=(p:Point,type:'origin'|'destination'|'checkpoint')=>{const checkpoint=type==='checkpoint';const icon=L.divIcon({className:'upc-pin',html:`<div class="pin ${checkpoint?'checkpoint-pin':''}"><span class="pin-dot">${type==='origin'?'A':type==='destination'?'B':'!'}</span><span class="pin-label"><b>${p.name}</b>${p.country?`<small>${p.country}</small>`:''}</span></div>`,iconSize:[190,48],iconAnchor:[14,40]});return L.marker([p.lat,p.lng],{icon}).addTo(m)}
    layers.push(pin(a,'origin'),pin(b,'destination'));checks.forEach(p=>layers.push(pin(p,'checkpoint')))
    routeCities.forEach(c=>layers.push(L.marker([c.lat,c.lng],{interactive:false,icon:L.divIcon({className:'upc-city',html:`<span>${c.name}</span>`,iconSize:[140,22],iconAnchor:[0,11]})}).addTo(m)))
    const moving=L.marker(route[active],{zIndexOffset:5000,icon:L.divIcon({className:'upc-moving',html:`<div class="moving ${isAir?'air':'ground'}"><span>${isAir?'✈':'➤'}</span><i></i></div>`,iconSize:[58,58],iconAnchor:[29,29]})}).addTo(m);layers.push(moving)
    const shouldMove=!isCheckpoint && status!=='delivered'
    if(shouldMove){let i=active;timer.current=setInterval(()=>{i=i>=route.length-1?active:i+1;moving.setLatLng(route[i])},650)}
    m.fitBounds(L.latLngBounds([a,b,...checks].map(p=>[p.lat,p.lng])),{padding:[45,45],maxZoom:9});setTimeout(()=>m.invalidateSize(false),250)
    return()=>{if(timer.current)clearInterval(timer.current);layers.forEach(x=>{try{m.removeLayer(x)}catch{}})}
  },[L,a,b,checks,route,routeCities,last,isAir,isCheckpoint,status])

  return <section className="tracker-map"><header><div><small>SHIPMENT TRACKING</small><h2>{status==='delivered'?'Shipment delivered':isOutForDelivery?'Out for delivery':isCheckpoint?'Shipment at checkpoint':isAir?'Shipment in transit by air':'Shipment in transit by road'}</h2><p>{last?`Latest scan · ${last.name}`:`${a?.name||origin} → ${b?.name||destination}`}</p></div><strong className={isCheckpoint?'paused':''}><i/>{isCheckpoint?'CHECKPOINT':status==='delivered'?'DELIVERED':'LIVE TRACKING'}</strong></header><div className="map"><div ref={el}/><div className="legend"><span><i className="route"/>Completed route</span><span><i className="remaining"/>Road / route ahead</span><span><i className="checkpoint"/>Checkpoint</span></div></div><div className="progress"><div><small>ORIGIN</small><b>{a?.name||origin}</b></div><em>→</em><div><small>CURRENT LOCATION</small><b>{last?.name||a?.name||'In transit'}</b></div><em>→</em><div><small>DESTINATION</small><b>{b?.name||destination}</b></div></div><style jsx>{`.tracker-map{margin:24px 0;background:#fff;border:1px solid #d6d9dc;border-radius:10px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,.08)}header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #e5e7eb}header small{font-size:10px;font-weight:900;letter-spacing:.12em;color:#6b7280}header h2{margin:5px 0 3px;font-size:21px;color:#351c15}header p{margin:0;color:#6b7280;font-size:12px}header strong{font-size:10px;color:#167a3d;white-space:nowrap}header strong i{display:inline-block;width:8px;height:8px;background:#20a15a;border-radius:50%;margin-right:6px;animation:blink 1.3s infinite}header strong.paused{color:#c1121f}header strong.paused i{background:#d92d20;animation:blinkRed .8s infinite}.map{height:530px;position:relative;background:#e9ecef}.map>div:first-child{width:100%;height:100%}.map :global(.leaflet-container){width:100%;height:100%;font-family:Arial,sans-serif;background:#e9ecef}.map :global(.leaflet-control-zoom){border:0!important;box-shadow:0 2px 9px #0003!important}.map :global(.upc-pin),.map :global(.upc-city),.map :global(.upc-moving){background:none;border:0}.map :global(.pin){display:flex;align-items:center;gap:6px}.map :global(.pin-dot){width:28px;height:28px;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;background:#351c15;color:#fff;font:900 10px Arial;box-shadow:0 2px 8px #0005}.map :global(.checkpoint-pin .pin-dot){background:#d92d20;animation:blinkRed .8s infinite}.map :global(.pin-label){background:#fff;border-radius:4px;padding:4px 7px;box-shadow:0 2px 8px #0004;font:700 10px Arial;color:#351c15;white-space:nowrap}.map :global(.pin-label small){display:block;color:#6b7280;font-size:8px;font-weight:500}.map :global(.upc-city span){display:block;background:rgba(255,255,255,.94);padding:3px 6px;border-radius:3px;color:#374151;font:700 10px Arial;box-shadow:0 1px 5px #0002}.map :global(.moving){width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:#ffb81c;color:#351c15;border:3px solid #fff;box-shadow:0 3px 14px #0006;font-size:22px;position:relative}.map :global(.moving.air){background:#20a15a;color:#fff}.map :global(.moving i){position:absolute;inset:-8px;border:2px solid #ffb81c;border-radius:50%;animation:ring 1.2s infinite}.map :global(.moving.air i){border-color:#20a15a}.legend{position:absolute;left:12px;bottom:12px;z-index:500;background:#fff;padding:8px 10px;border-radius:5px;box-shadow:0 2px 12px #0003;display:flex;gap:12px;font:700 9px Arial;color:#475467}.legend i{display:inline-block;width:20px;height:4px;border-radius:3px;margin-right:4px;vertical-align:middle}.legend .route{background:#ffb81c}.legend .remaining{background:#68717d}.legend .checkpoint{width:9px;height:9px;background:#d92d20;border-radius:50%}.progress{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid #e5e7eb}.progress div{display:flex;flex-direction:column;gap:3px}.progress small{font-size:9px;letter-spacing:.08em;color:#6b7280}.progress b{font-size:12px;color:#351c15}.progress em{font-style:normal;color:#ffb81c;font-weight:900}@keyframes blink{50%{opacity:.35}}@keyframes blinkRed{50%{opacity:.25;transform:scale(.82)}}@keyframes ring{0%{transform:scale(.7);opacity:1}100%{transform:scale(1.35);opacity:0}}@media(max-width:700px){header{align-items:flex-start;flex-direction:column;gap:8px}.map{height:430px}.progress{grid-template-columns:1fr;gap:7px}.progress em{display:none}.legend{max-width:92%;flex-wrap:wrap}}`}</style></section>
}
