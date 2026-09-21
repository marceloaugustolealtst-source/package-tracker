'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {createClient} from '@/lib/supabase-browser'
import type * as Leaflet from 'leaflet'

export type TrackingEvent={id:string;location:string|null;status:string;created_at?:string;description?:string;event_time?:string;latitude?:number|null;longitude?:number|null}

type Point={name:string;country?:string;lat:number;lng:number}

type Props={
  trackingNumber?:string
  origin:string
  destination:string
  status:string
  transportMode?:string
  events:TrackingEvent[]
}

declare global{
  interface Window{L?:typeof import('leaflet')}
}

const cities:Point[]=[
  {name:'Warsaw',country:'Poland',lat:52.2297,lng:21.0122},
  {name:'Prague',country:'Czech Republic',lat:50.0755,lng:14.4378},
  {name:'Frankfurt',country:'Germany',lat:50.1109,lng:8.6821},
  {name:'Zurich',country:'Switzerland',lat:47.3769,lng:8.5417},
  {name:'Paris',country:'France',lat:48.8566,lng:2.3522},
  {name:'Madrid',country:'Spain',lat:40.4168,lng:-3.7038},
  {name:'Lisbon',country:'Portugal',lat:38.7223,lng:-9.1393},
  {name:'Praia',country:'Cape Verde',lat:14.9331,lng:-23.5133},
  {name:'São Paulo',country:'Brazil',lat:-23.5505,lng:-46.6333},
  {name:'Rio de Janeiro',country:'Brazil',lat:-22.9068,lng:-43.1729},
  {name:'London',country:'United Kingdom',lat:51.5074,lng:-0.1278},
  {name:'Berlin',country:'Germany',lat:52.52,lng:13.405},
  {name:'New York',country:'United States',lat:40.7128,lng:-74.006},
  {name:'Miami',country:'United States',lat:25.7617,lng:-80.1918},
  {name:'Toronto',country:'Canada',lat:43.6532,lng:-79.3832}
]

const normalize=(v:string='')=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
const simpleLocation=(value:string='')=>{
  const parts=value.split(',').map(v=>v.trim()).filter(Boolean)
  if(parts.length>=2)return parts.slice(0,2).join(', ')
  return parts[0]||value
}
const findPoint=(value:string)=>{
  const v=normalize(value)
  return cities.find(p=>v.includes(normalize(p.name)))||null
}
const latestEvent=(events:TrackingEvent[])=>events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime())[0]||null

async function geocode(query:string):Promise<Point|null>{
  if(!query.trim())return null
  try{
    const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q='+encodeURIComponent(query),{headers:{'Accept-Language':'en'}})
    if(!response.ok)return null
    const data=await response.json()
    const item=data?.[0]
    if(!item)return null
    const address=item.address||{}
    return{
      name:String(address.city||address.town||address.village||address.municipality||address.suburb||query),
      country:String(address.country||''),
      lat:Number(item.lat),
      lng:Number(item.lon)
    }
  }catch{return null}
}

async function resolvePoint(value:string):Promise<Point|null>{
  return findPoint(value)||await geocode(value)
}

export default function TrackingRouteMap({origin,destination,status,events:initialEvents}:Props){
  const ref=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<Leaflet.Map|null>(null)
  const layerRef=useRef<Leaflet.Layer[]>([])
  const [events,setEvents]=useState(initialEvents)
  const [liveStatus,setLiveStatus]=useState(status)
  const [mapReady,setMapReady]=useState(false)
  const [mapError,setMapError]=useState('')

  const latest=useMemo(()=>latestEvent(events),[events])
  const latestIsCheckpoint=(latest?.status||liveStatus||'').toLowerCase()==='checkpoint'
  const currentText=simpleLocation(latest?.location||origin||'Current location')
  const destinationText=simpleLocation(destination||'Destination')
  const moving=['processing','in_transit','out_for_delivery'].includes((liveStatus||latest?.status||'').toLowerCase().replace(/\s+/g,'_'))

  useEffect(()=>{setEvents(initialEvents);setLiveStatus(status)},[initialEvents,status])

  useEffect(()=>{
    let cancelled=false
    const refresh=async()=>{
      try{
        const supabase=createClient()
        const {data:pkg}=await supabase.rpc('get_tracking_package',{p_tracking_number:origin?undefined:undefined})
        void pkg
      }catch{}
    }
    void refresh()
    return()=>{cancelled=true;void cancelled}
  },[])

  useEffect(()=>{
    let cancelled=false
    import('leaflet').then(L=>{
      if(cancelled||!ref.current)return
      const map=L.map(ref.current,{scrollWheelZoom:false,zoomControl:true,worldCopyJump:true,preferCanvas:true}).setView([20,0],3)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,
        attribution:'© OpenStreetMap contributors'
      }).addTo(map)
      mapRef.current=map
      setMapReady(true)
      window.setTimeout(()=>map.invalidateSize(),100)
    }).catch(error=>{
      console.error(error)
      if(!cancelled)setMapError('Map could not be loaded.')
    })
    return()=>{
      cancelled=true
      layerRef.current.forEach(layer=>layer.remove())
      layerRef.current=[]
      mapRef.current?.remove()
      mapRef.current=null
    }
  },[])

  useEffect(()=>{
    if(!mapReady||!mapRef.current)return
    let cancelled=false
    const render=async()=>{
      const L=await import('leaflet')
      if(cancelled||!mapRef.current)return
      const map=mapRef.current
      layerRef.current.forEach(layer=>layer.remove())
      layerRef.current=[]

      const currentCoords=latest?.latitude!=null&&latest?.longitude!=null
        ? {lat:Number(latest.latitude),lng:Number(latest.longitude)}
        : await resolvePoint(latest?.location||origin)

      const destinationCoords=await resolvePoint(destination)

      const fallback=currentCoords||findPoint(origin)
      const end=destinationCoords||findPoint(destination)

      if(!fallback){
        map.setView([20,0],3)
        setMapError('')
        return
      }

      const currentName=latest?.location?simpleLocation(latest.location):simpleLocation(origin||'Current location')
      const currentPoint={name:currentName,lat:fallback.lat,lng:fallback.lng}
      const points:Point[]=[currentPoint]

      if(end)points.push({name:destinationText,country:end.country,lat:end.lat,lng:end.lng})

      if(end){
        const route=L.polyline(
          [[fallback.lat,fallback.lng],[end.lat,end.lng]],
          {color:'#351c15',weight:5,opacity:.92,lineCap:'round',lineJoin:'round'}
        ).addTo(map)
        layerRef.current.push(route)
      }

      const currentIcon=L.divIcon({
        className:'upc-current-marker',
        html:`<div class="upc-location-box">📍 ${currentName}</div><div class="upc-location-arrow">🔻</div>`,
        iconSize:[220,64],
        iconAnchor:[110,60]
      })

      const currentMarker=L.marker([fallback.lat,fallback.lng],{icon:currentIcon,title:'Current location'}).addTo(map)
      layerRef.current.push(currentMarker)

      if(end){
        const destinationIcon=L.divIcon({
          className:'upc-destination-marker',
          html:'<div class="upc-destination-dot"></div>',
          iconSize:[22,22],
          iconAnchor:[11,11]
        })
        const destinationMarker=L.marker([end.lat,end.lng],{icon:destinationIcon,title:'Destination'}).addTo(map)
        layerRef.current.push(destinationMarker)

        const bounds=L.latLngBounds([[fallback.lat,fallback.lng],[end.lat,end.lng]])
        map.fitBounds(bounds,{padding:[70,70],maxZoom:6})
      }else{
        map.setView([fallback.lat,fallback.lng],6)
      }

      setMapError('')
      window.setTimeout(()=>map.invalidateSize(),120)
    }

    render().catch(error=>{
      console.error(error)
      if(!cancelled)setMapError('Map could not be rendered.')
    })

    return()=>{cancelled=true}
  },[mapReady,latest,origin,destination,destinationText])

  const statusLabel=(liveStatus||latest?.status||'in_transit').replace(/_/g,' ')

  return <section className="tracker-card">
    <div className="summary">
      <div>
        <span className="eyebrow">SHIPMENT STATUS</span>
        <h2>{statusLabel}</h2>
        <p>Current location: {currentText}</p>
      </div>
      <span className={'pill '+(latestIsCheckpoint?'checkpoint-active':moving?'moving':'checkpoint')}>{latestIsCheckpoint?'CHECKPOINT':moving?'LIVE':'UPDATED'}</span>
    </div>
    <div className="map-shell">
      <div className="map-title"><b>UPC Shipment Journey</b></div>
      <div ref={ref} className="real-map"/>
      {mapError&&<div className="map-fallback"><b>Map unavailable</b><span>{mapError}</span></div>}
    </div>
    {moving&&<div className="live-strip"><span className="pulse"/><b>LIVE TRACKING</b><span>Updates automatically</span></div>}
    <div className="timeline">
      <h3>Tracking history</h3>
      {events.length?events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime()).map((e,i)=><div className="event" key={e.id||i}>
        <div className={'event-dot '+(i===0?'current ':'')+(i===0&&latestIsCheckpoint?'checkpoint-current ':'')}>{i!==0?'✓':''}</div>
        <div><b>{e.status.replaceAll('_',' ')}</b><span>{simpleLocation(e.location||'Shipment facility')}</span>{e.event_time&&<small>{new Date(e.event_time).toLocaleString()}</small>}{e.description&&<p>{e.description}</p>}</div>
      </div>):<div className="empty">No tracking events have been recorded yet.</div>}
    </div>
    <style jsx>{`
      @keyframes checkpointBlink{0%,100%{opacity:1;box-shadow:0 0 0 0 #dc262655}50%{opacity:.55;box-shadow:0 0 0 6px #dc26261c}}.tracker-card{margin-top:18px;border:1px solid #dfe3e7;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 28px #10182812}
      .summary{padding:18px 20px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb}
      .summary h2{margin:5px 0;text-transform:capitalize;font-size:24px;color:#351c15}
      .summary p{margin:0;color:#667085;font-size:12px}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.12em;color:#7a1f16}
      .pill{padding:0;background:transparent;border:0;border-radius:0;font-size:9px;font-weight:800;line-height:1}.checkpoint-active{color:#b00000;animation:checkpointBlink 1s infinite}.moving{color:#16a34a}.moving::before{content:'●';margin-right:4px;display:inline-block}.checkpoint{color:#7a1f16}
      .map-shell{height:520px;position:relative;background:#e9edf0}.real-map{position:absolute;inset:0}
      .map-title{position:absolute;z-index:1000;top:14px;left:14px;background:#fff;border-left:5px solid #ffca05;border-radius:4px;padding:10px 13px;box-shadow:0 3px 12px #0002}.map-title b{font-size:12px;color:#351c15}.map-title span{display:block;margin-top:3px;font-size:10px;color:#667085}
      .map-fallback{position:absolute;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#eef1ed}.map-fallback span{color:#667085;margin-top:5px}
      .upc-location-box,.upc-destination-box{background:#fff;border:2px solid #351c15;border-radius:7px;box-shadow:0 3px 12px #0003;color:#351c15;padding:7px 11px;font-size:11px;font-weight:800;text-align:center;white-space:nowrap}
      .upc-destination-box{border-color:#ffca05}.upc-destination-dot{width:16px;height:16px;border-radius:50%;background:#ffca05;border:4px solid #351c15;box-shadow:0 2px 8px #0003}.upc-location-arrow{font-size:28px;line-height:28px;text-align:center;filter:drop-shadow(0 2px 3px #0006)}
      @keyframes liveGreenPulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #16a34a55}50%{opacity:.45;box-shadow:0 0 0 5px #16a34a22}}.live-strip{padding:9px 16px;display:flex;gap:8px;align-items:center;border-top:1px solid #eee;font-size:11px}.pulse{width:8px;height:8px;border-radius:50%;background:#16a34a;animation:liveGreenPulse 1.2s infinite}.live-strip b{color:#16a34a}
      .timeline{padding:20px;background:#fff}.timeline h3{margin:0 0 15px;color:#351c15}.event{display:flex;gap:12px;padding:0 0 18px}.event-dot{width:22px;height:22px;flex:0 0 22px;border-radius:50%;background:#351c15;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900}.event-dot.current{background:#ffca05;color:#351c15;border:2px solid #351c15}.event b{display:block;text-transform:capitalize;color:#351c15}.event span,.event small{display:block;color:#667085;font-size:11px;margin-top:3px}.event p{margin:5px 0 0;color:#475467;font-size:11px}
    `}</style>
  </section>
}
