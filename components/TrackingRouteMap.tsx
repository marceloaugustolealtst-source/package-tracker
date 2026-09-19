'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {createClient} from '@/lib/supabase-browser'
import type * as Leaflet from 'leaflet'

export type TrackingEvent={id:string;location:string|null;status:string;created_at?:string;description?:string;event_time?:string;latitude?:number|null;longitude?:number|null}
type Point={name:string;lat:number;lng:number}
type Props={trackingNumber:string;origin:string;destination:string;status:string;transportMode?:string;events:TrackingEvent[]}

const normalize=(v:string='')=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
const clean=(v:string='')=>{const p=v.split(',').map(x=>x.trim()).filter(Boolean);return p.length>1&&normalize(p[p.length-1])===normalize(p[p.length-2])?p.slice(0,-1).join(', '):p.join(', ')}
const latestOf=(events:TrackingEvent[])=>events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime())[0]||null
const pointFromEvent=(e:TrackingEvent|null):Point|null=>e?.latitude!=null&&e?.longitude!=null?{name:e.location||'Current location',lat:Number(e.latitude),lng:Number(e.longitude)}:null

async function geocode(q:string):Promise<Point|null>{
 try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});const d=await r.json();if(d?.[0])return{name:q,lat:Number(d[0].lat),lng:Number(d[0].lon)}}catch{}return null
}

export default function TrackingRouteMap({trackingNumber,origin,destination,status,events:initialEvents}:Props){
 const ref=useRef<HTMLDivElement|null>(null),mapRef=useRef<Leaflet.Map|null>(null),layersRef=useRef<Leaflet.Layer[]>([])
 const [events,setEvents]=useState(initialEvents),[statusLive,setStatusLive]=useState(status),[error,setError]=useState('')
 const latest=useMemo(()=>latestOf(events),[events]),current=useMemo(()=>pointFromEvent(latest),[latest])
 const currentText=clean(latest?.location||origin||'Current location'),destinationText=clean(destination||'Destination')
 const moving=['processing','in_transit','out_for_delivery'].includes((statusLive||latest?.status||'').toLowerCase().replace(/\s+/g,'_'))

 useEffect(()=>{setEvents(initialEvents);setStatusLive(status)},[initialEvents,status])
 useEffect(()=>{let dead=false;const poll=async()=>{try{const s=createClient();const {data:p}=await s.rpc('get_tracking_package',{p_tracking_number:trackingNumber.toUpperCase()});const pkg=p?.[0];if(!pkg)return;const {data:e}=await s.rpc('get_tracking_events',{p_shipment_id:pkg.id});if(!dead){setStatusLive(pkg.status||status);if(e)setEvents(e as TrackingEvent[])}}catch{}};const t=setInterval(poll,15000);return()=>{dead=true;clearInterval(t)}},[trackingNumber,status])

 useEffect(()=>{
  let dead=false
  import('leaflet').then(async L=>{
   if(dead||!ref.current)return
   const map=L.map(ref.current,{zoomControl:true,scrollWheelZoom:false,worldCopyJump:true,attributionControl:true}).setView([20,0],3)
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map)
   mapRef.current=map
   const points=events.slice().sort((a,b)=>new Date(a.event_time||a.created_at||0).getTime()-new Date(b.event_time||b.created_at||0).getTime()).map(pointFromEvent).filter(Boolean) as Point[]
   const start=current||points[points.length-1]
   const end=await geocode(destinationText)
   if(dead)return
   layersRef.current.forEach(x=>x.remove());layersRef.current=[]
   const all=(points.length?points:[]).slice().sort((a,b)=>a.lat-b.lat||a.lng-b.lng)
   if(start&&!all.some(p=>Math.abs(p.lat-start.lat)<.0001&&Math.abs(p.lng-start.lng)<.0001))all.push(start)
   if(end)all.push(end)
   if(all.length>1){ const line=L.polyline(all.map(p=>[p.lat,p.lng] as [number,number]),{color:'#351c15',weight:4,opacity:.7,lineCap:'round',lineJoin:'round'}).addTo(map); layersRef.current.push(line) }
   all.forEach((p,i)=>{
    const isCurrent=start&&Math.abs(p.lat-start.lat)<.0001&&Math.abs(p.lng-start.lng)<.0001
    const marker=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'upc-location',html:isCurrent?`<div class="upc-box">📍 ${clean(p.name)}</div><div class="upc-arrow">🔻</div>`:'',iconSize:isCurrent?[180,58]:[1,1],iconAnchor:isCurrent?[90,52]:[0,0]})}).addTo(map)
    if(isCurrent)marker.bindTooltip(clean(p.name),{permanent:false})
    else marker.setOpacity(i===all.length-1?.65:1)
    layersRef.current.push(marker)
   })
   if(all.length)map.fitBounds(L.latLngBounds(all.map(p=>[p.lat,p.lng] as [number,number])),{padding:[70,70],maxZoom:6})
   setError('')
  }).catch(()=>setError('Map could not be loaded.'))
  return()=>{dead=true;layersRef.current.forEach(x=>x.remove());layersRef.current=[];mapRef.current?.remove();mapRef.current=null}
 },[events,current,destinationText])

 const statusLabel=(statusLive||latest?.status||'in_transit').replace(/_/g,' ')
 return <section className="tracker-card"><div className="summary"><div><span className="eyebrow">SHIPMENT STATUS</span><h2>{statusLabel}</h2><p>Current location: {currentText}</p></div><span className={'pill '+(moving?'moving':'checkpoint')}>{moving?'LIVE':'UPDATED'}</span></div><div className="map-shell"><div className="map-title"><b>UPC Shipment Journey</b><span>{currentText} → {destinationText}</span></div><div ref={ref} className="real-map"/>{error&&<div className="map-fallback"><b>Map unavailable</b><span>{error}</span></div>}</div>{moving&&<div className="live-strip"><span className="pulse"/><b>LIVE TRACKING</b><span>Updates automatically every 15 seconds</span></div>}<div className="timeline"><h3>Tracking history</h3>{events.length?events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime()).map((e,i)=><div className="event" key={e.id||i}><div className={'event-dot '+(i===0?'current':'')}>{i!==0?'✓':''}</div><div><b>{e.status.replaceAll('_',' ')}</b><span>{clean(e.location||'Shipment facility')}</span>{e.event_time&&<small>{new Date(e.event_time).toLocaleString()}</small>}{e.description&&<p>{e.description}</p>}</div></div>):<div className="empty">No tracking events have been recorded yet.</div>}</div><style jsx>{`.tracker-card{margin-top:18px;border:1px solid #dfe3e7;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 28px #10182812}.summary{padding:18px 20px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb}.summary h2{margin:5px 0;text-transform:capitalize;font-size:24px;color:#351c15}.summary p{margin:0;color:#667085;font-size:12px}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.12em;color:#7a1f16}.pill{padding:7px 11px;border-radius:18px;font-size:9px;font-weight:900}.moving{background:#fff0c2;color:#351c15}.checkpoint{background:#f5f5f3;color:#7a1f16}.map-shell{height:520px;position:relative;background:#eef1ed}.real-map{position:absolute;inset:0}.map-title{position:absolute;z-index:1000;top:14px;left:14px;background:#fff;border-left:5px solid #ffca05;border-radius:4px;padding:10px 13px;box-shadow:0 3px 12px #0002}.map-title b{font-size:12px;color:#351c15}.map-title span{display:block;margin-top:3px;font-size:10px;color:#667085}.map-fallback{position:absolute;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#eef1ed}.live-strip{padding:9px 16px;display:flex;gap:8px;align-items:center;border-top:1px solid #eee;font-size:11px}.pulse{width:8px;height:8px;border-radius:50%;background:#ffca05}.timeline{padding:20px;background:#fff}.timeline h3{margin:0 0 15px;color:#351c15}.event{display:flex;gap:12px;padding:0 0 18px}.event-dot{width:22px;height:22px;flex:0 0 22px;border-radius:50%;background:#351c15;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900}.event-dot.current{background:#ffca05;color:#351c15;border:2px solid #351c15}.event b{display:block;text-transform:capitalize;color:#351c15}.event span,.event small{display:block;color:#667085;font-size:11px;margin-top:3px}.event p{margin:5px 0 0;color:#475467;font-size:11px}`}</style></section>
}
