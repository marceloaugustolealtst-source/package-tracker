'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {createClient} from '@/lib/supabase-browser'

export type TrackingEvent={id:string;location:string|null;status:string;created_at?:string;description?:string;event_time?:string;latitude?:number|null;longitude?:number|null}
type Point={name:string;country?:string;lat:number;lng:number}
type Props={trackingNumber:string;origin:string;destination:string;status:string;transportMode?:string;events:TrackingEvent[]}

declare global{interface Window{google?:any}}

const normalize=(v:string='')=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
const duplicateCountry=(v:string='')=>{const parts=v.split(',').map(x=>x.trim()).filter(Boolean);if(parts.length>1&&normalize(parts[parts.length-1])===normalize(parts[parts.length-2]))parts.pop();return parts.join(', ')}
const latestOf=(events:TrackingEvent[])=>events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime())[0]||null

function pointFromEvent(e:TrackingEvent|null):Point|null{
 if(!e)return null
 if(e.latitude!=null&&e.longitude!=null)return{name:e.location||'Current location',lat:Number(e.latitude),lng:Number(e.longitude)}
 return null
}

function loadGoogle(key:string):Promise<any>{
 return new Promise((resolve,reject)=>{
  if(window.google?.maps)return resolve(window.google.maps)
  const existing=document.querySelector('script[data-upc-google-maps]') as HTMLScriptElement|null
  if(existing){existing.addEventListener('load',()=>resolve(window.google.maps));existing.addEventListener('error',reject);return}
  const s=document.createElement('script')
  s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&v=weekly'
  s.async=true;s.defer=true;s.dataset.upcGoogleMaps='1'
  s.onload=()=>window.google?.maps?resolve(window.google.maps):reject(new Error('Google Maps did not initialize'))
  s.onerror=reject
  document.head.appendChild(s)
 })
}

const mapStyle=[
 {featureType:'all',elementType:'labels.text',stylers:[{color:'#263238'},{weight:700}]},
 {featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},
 {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#b7bec4'},{weight:1.6}]},
 {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#ffffff'},{weight:3}]},
 {featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#7f8a93'},{weight:2}]},
 {featureType:'road.arterial',elementType:'geometry',stylers:[{color:'#ffffff'},{weight:2.2}]},
 {featureType:'road.local',elementType:'geometry',stylers:[{color:'#f4f6f7'}]},
 {featureType:'water',elementType:'geometry',stylers:[{color:'#dbeaf2'}]},
 {featureType:'landscape',elementType:'geometry',stylers:[{color:'#eef1ed'}]},
 {featureType:'poi',elementType:'geometry',stylers:[{color:'#e2e6e1'}]},
 {featureType:'transit',elementType:'geometry',stylers:[{color:'#d9dde0'}]}
]

export default function TrackingRouteMap({trackingNumber,origin,destination,status,transportMode='Road',events:initialEvents}:Props){
 const ref=useRef<HTMLDivElement|null>(null)
 const mapRef=useRef<any>(null)
 const directionsRef=useRef<any>(null)
 const markerRefs=useRef<any[]>([])
 const timerRef=useRef<ReturnType<typeof setInterval>|null>(null)
 const [events,setEvents]=useState(initialEvents)
 const [statusLive,setStatusLive]=useState(status)
 const [ready,setReady]=useState(false)
 const [mapError,setMapError]=useState('')
 const latest=useMemo(()=>latestOf(events),[events])
 const currentPoint=useMemo(()=>pointFromEvent(latest),[latest])
 const currentText=duplicateCountry(latest?.location||origin||'Current location')
 const finalText=duplicateCountry(destination||'Destination')
 const moving=['processing','in_transit','out_for_delivery'].includes((statusLive||latest?.status||'').toLowerCase().replace(/\\s+/g,'_'))
 const mode=normalize(transportMode)

 useEffect(()=>{setEvents(initialEvents);setStatusLive(status)},[initialEvents,status])

 // Live shipment refresh: the page stays open while the tracking data changes.
 useEffect(()=>{
  let cancelled=false
  const poll=async()=>{
   try{
    const supabase=createClient()
    const {data:pkg}=await supabase.rpc('get_tracking_package',{p_tracking_number:trackingNumber.toUpperCase()})
    const p=pkg?.[0]
    if(!p)return
    const {data:ev}=await supabase.rpc('get_tracking_events',{p_shipment_id:p.id})
    if(!cancelled){
      setStatusLive(p.status||status)
      if(ev)setEvents(ev as TrackingEvent[])
    }
   }catch{}
  }
  timerRef.current=setInterval(poll,15000)
  return()=>{cancelled=true;if(timerRef.current)clearInterval(timerRef.current)}
 },[trackingNumber,status])

 useEffect(()=>{
  let cancelled=false
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if(!key){setMapError('Google Maps API key is not configured.');return}
  loadGoogle(key).then((maps)=>{
   if(cancelled||!ref.current)return
   mapRef.current=new maps.Map(ref.current,{
    center:{lat:20,lng:0},zoom:3,
    disableDefaultUI:false,scrollwheel:false,gestureHandling:'cooperative',
    fullscreenControl:true,mapTypeControl:false,streetViewControl:false,
    styles:mapStyle
   })
   directionsRef.current=new maps.DirectionsService()
   setReady(true)
  }).catch(()=>{if(!cancelled)setMapError('The map service could not be loaded.')})
  return()=>{cancelled=true;markerRefs.current.forEach(m=>m.setMap?.(null));markerRefs.current=[];mapRef.current=null}
 },[])

 useEffect(()=>{
  if(!ready||!mapRef.current||!window.google?.maps)return
  const maps=window.google.maps
  const map=mapRef.current
  markerRefs.current.forEach(m=>m.setMap(null));markerRefs.current=[]
  const latestStatus=(statusLive||latest?.status||'').toLowerCase().replace(/\\s+/g,'_')
  const current=latest?.location||origin
  const destinationValue=destination
  const bounds=new maps.LatLngBounds()

  const addMarker=(position:any,label:string,kind:'current'|'destination')=>{
   const marker=new maps.Marker({
    map,position,title:label,
    label:{text:kind==='current'?'UPC':'',color:kind==='current'?'#ffffff':'#d40511',fontWeight:'900',fontSize:'13px'},
    icon:{path:maps.SymbolPath.CIRCLE,scale:kind==='current'?10:8,fillColor:kind==='current'?'#d40511':'#ffffff',fillOpacity:1,strokeColor:kind==='current'?'#ffffff':'#d40511',strokeWeight:4}
   })
   markerRefs.current.push(marker);bounds.extend(position)
  }

  const drawStraight=()=>{
   const a=currentPoint
   if(!a)return
   const geocoder=new maps.Geocoder()
   geocoder.geocode({address:destinationValue},(res:any,st:any)=>{
    if(st!=='OK'||!res?.[0])return
    const b=res[0].geometry.location
    addMarker({lat:a.lat,lng:a.lng},duplicateCountry(currentText),'current')
    addMarker(b,finalText,'destination')
    new maps.Polyline({map,path:[{lat:a.lat,lng:a.lng},b],geodesic:true,strokeColor:'#d40511',strokeOpacity:1,strokeWeight:5})
    bounds.extend(b);map.fitBounds(bounds,{top:70,right:45,bottom:45,left:45})
   })
  }

  const canRoadRoute=['road','truck','parcel',''].includes(mode)&&current
  if(canRoadRoute){
   directionsRef.current.route({
    origin:current,
    destination:destinationValue,
    travelMode:maps.TravelMode.DRIVING,
    provideRouteAlternatives:false
   },(result:any,st:any)=>{
    if(st==='OK'&&result){
     const renderer=new maps.DirectionsRenderer({
      map,suppressMarkers:true,preserveViewport:false,
      polylineOptions:{strokeColor:'#d40511',strokeOpacity:1,strokeWeight:6,zIndex:5}
     })
     renderer.setDirections(result)
     directionsRef.current.__renderer=renderer
     const leg=result.routes[0]?.legs?.[0]
     if(leg){addMarker(leg.start_location,duplicateCountry(currentText),'current');addMarker(leg.end_location,finalText,'destination')}
    }else drawStraight()
   })
  }else drawStraight()

  return()=>{
   if(directionsRef.current?.__renderer){directionsRef.current.__renderer.setMap(null);directionsRef.current.__renderer=null}
   markerRefs.current.forEach(m=>m.setMap(null));markerRefs.current=[]
  }
 },[ready,currentPoint,currentText,finalText,destination,origin,mode,statusLive,latest])

 const statusLabel=(statusLive||latest?.status||'in_transit').replace(/_/g,' ')
 return <section className="tracker-card">
  <div className="summary">
   <div><span className="eyebrow">SHIPMENT STATUS</span><h2>{statusLabel}</h2><p>Current location: {currentText}</p></div>
   <span className={'pill '+(moving?'moving':'checkpoint')}>{moving?'LIVE':'UPDATED'}</span>
  </div>
  <div className="map-shell">
   <div className="map-title"><b>UPC Shipment Journey</b><span>{currentText} → {finalText}</span></div>
   <div ref={ref} className="real-map"/>
   {mapError&&<div className="map-fallback"><b>Map unavailable</b><span>{mapError}</span><small>Tracking information remains available below.</small></div>}
  </div>
  {moving&&<div className="live-strip"><span className="pulse"/><b>LIVE TRACKING</b><span>Updates automatically every 15 seconds</span></div>}
  <div className="timeline"><h3>Tracking history</h3>{events.length?events.slice().sort((a,b)=>new Date(b.event_time||b.created_at||0).getTime()-new Date(a.event_time||a.created_at||0).getTime()).map((e,i)=><div className="event" key={e.id||i}><div className={'event-dot '+(i===0?'current':'')}>{i!==0?'✓':''}</div><div><b>{e.status.replaceAll('_',' ')}</b><span>{duplicateCountry(e.location||'Shipment facility')}</span>{e.event_time&&<small>{new Date(e.event_time).toLocaleString()}</small>}{e.description&&<p>{e.description}</p>}</div></div>):<div className="empty">No tracking events have been recorded yet.</div>}</div>
  <style jsx>{\`.tracker-card{margin-top:18px;border:1px solid #dfe3e7;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 28px #10182812}.summary{padding:18px 20px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb}.summary h2{margin:5px 0;text-transform:capitalize;font-size:24px;color:#101828}.summary p{margin:0;color:#667085;font-size:12px}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.12em;color:#667085}.pill{padding:7px 11px;border-radius:18px;font-size:9px;font-weight:900}.moving{background:#e8f7ef;color:#087443}.checkpoint{background:#fff3f3;color:#c62828}.map-shell{height:520px;position:relative;background:#e8ecef}.real-map{position:absolute;inset:0}.map-title{position:absolute;z-index:5;top:14px;left:14px;background:#fff;border-left:5px solid #d40511;border-radius:3px;padding:10px 13px;box-shadow:0 3px 12px #0002}.map-title b{font-size:12px}.map-title span{display:block;margin-top:3px;font-size:10px;color:#667085}.map-fallback{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:6px;background:#eef1ed;color:#344054;text-align:center;padding:20px}.map-fallback span,.map-fallback small{display:block;color:#667085}.live-strip{padding:10px 15px;display:flex;align-items:center;gap:8px;background:#f3fbf7;color:#087443;font-size:10px;border-top:1px solid #e4e7ec}.pulse{width:7px;height:7px;border-radius:50%;background:#087443;animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.25}}.timeline{padding:20px;border-top:1px solid #e4e7ec}.timeline h3{margin:0 0 18px;font-size:18px}.event{display:flex;gap:12px;position:relative;padding:0 0 19px 25px;margin-left:6px;border-left:2px solid #c8dfd0}.event:last-child{border-left-color:transparent}.event-dot{position:absolute;left:-9px;top:0;width:16px;height:16px;border-radius:50%;background:#087443;color:#fff;border:3px solid #fff;box-shadow:0 0 0 1px #08744355;font-size:8px;display:grid;place-items:center}.event-dot.current{background:#fff;color:#087443}.event b{font-size:12px;text-transform:capitalize}.event span,.event small{display:block;margin-top:4px;color:#667085;font-size:10px}.event p{margin:5px 0 0;color:#667085;font-size:10px}.empty{color:#667085;font-size:12px}@media(max-width:760px){.map-shell{height:390px}.map-title span{display:none}.summary{padding:15px}.summary h2{font-size:21px}.timeline{padding:16px}}\`}</style>
 </section>
}
