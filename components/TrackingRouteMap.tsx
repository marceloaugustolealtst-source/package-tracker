'use client';
import { useEffect, useMemo, useState } from 'react';

type Event={id:string;location:string|null;status:string;created_at?:string};
type Point={name:string;x:number;y:number};

const cities:Point[]=[
 {name:'Toronto',x:12,y:18},{name:'New York',x:18,y:27},{name:'London',x:48,y:20},{name:'Paris',x:51,y:27},
 {name:'Warsaw',x:55,y:22},{name:'Cairo',x:59,y:39},{name:'Dubai',x:65,y:43},{name:'Mumbai',x:72,y:56},
 {name:'Lagos',x:39,y:58},{name:'Nairobi',x:55,y:67},{name:'Johannesburg',x:45,y:78},{name:'São Paulo',x:25,y:78},
 {name:'Singapore',x:82,y:72},{name:'Tokyo',x:91,y:34},{name:'Sydney',x:88,y:88}
];
const city=(value:string)=>{const t=(value||'').toLowerCase();return cities.find(c=>t.includes(c.name.toLowerCase()))||null};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

export default function TrackingRouteMap({origin,destination,status,events}:{origin:string;destination:string;status:string;events:Event[]}){
 const start=useMemo(()=>city(origin)||cities.find(c=>c.name==='Lagos')!,[origin]);
 const end=useMemo(()=>city(destination)||cities.find(c=>c.name==='Warsaw')!,[destination]);
 const route=useMemo(()=>{
  const candidates=cities.filter(c=>c.name!==start.name&&c.name!==end.name).filter(c=>{
   const direct=distance(start,end), via=distance(start,c)+distance(c,end); return via<=direct*1.5;
  }).sort((a,b)=>distance(start,a)-distance(start,b));
  const count=Math.min(3,candidates.length), points=[start];
  for(let i=0;i<count;i++){const idx=Math.floor((i+1)*candidates.length/(count+1));if(candidates[idx])points.push(candidates[idx]);}
  points.push(end); return points;
 },[start,end]);
 const stopped=['processing','at_hub','exception','delivered'].includes(status);
 const [progress,setProgress]=useState(0);
 useEffect(()=>{if(stopped)return;const timer=setInterval(()=>setProgress(v=>v>=route.length-1?0:v+0.0025),90);return()=>clearInterval(timer)},[stopped,route.length]);
 const segment=Math.min(Math.floor(progress),route.length-2), local=progress-segment;
 const from=route[segment]||route[0], to=route[segment+1]||route[0];
 const x=from.x+(to.x-from.x)*local,y=from.y+(to.y-from.y)*local;
 const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
 const current=stopped?(status==='delivered'?end:route[Math.min(segment,route.length-1)]):{name:from.name,x,y};
 const latest=events[events.length-1];
 const label=stopped?(status==='delivered'?'Delivered':status==='exception'?'Shipment exception':'At facility'):'In transit';
 return <section className="tracker-card">
  <div className="summary">
   <div><span className="eyebrow">SHIPMENT STATUS</span><h2>{label}</h2><p>{stopped?`Package is currently at ${current.name}`:`Package is moving from ${from.name} toward ${to.name}`}</p></div>
   <span className={`pill ${stopped?'hold':'moving'}`}>{stopped?'CHECKPOINT':'● LIVE TRANSIT'}</span>
  </div>
  <div className="route-bar"><div><small>FROM</small><b>{origin}</b></div><div className="arrow">→</div><div><small>TO</small><b>{destination}</b></div></div>
  <div className="map">
   <div className="map-title"><b>Shipment journey</b><span>{latest?.location||current.name}</span></div>
   <div className="map-grid"/>
   <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path className="route-bg" d={`M ${route.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}`}/><path className="route-line" d={`M ${route.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}`}/></svg>
   {route.map((c,i)=><div key={c.name} className={`city ${i===0?'origin':i===route.length-1?'destination':'checkpoint'}`} style={{left:`${c.x}%`,top:`${c.y}%`}}><i/><span>{c.name}</span></div>)}
   {!stopped&&<div className="aircraft" style={{left:`${x}%`,top:`${y}%`,transform:`translate(-50%,-50%) rotate(${angle}deg)`}}>✈</div>}
   {stopped&&<div className="hold-marker" style={{left:`${current.x}%`,top:`${current.y}%`}}>✓</div>}
  </div>
  <div className="legend"><span><i className="green"/>Completed route</span><span><i className="dot"/>Checkpoint</span><span><i className="plane-dot">✈</i>Live position</span></div>
  <div className="timeline">
   <h3>Tracking history</h3>
   {events.length?events.slice().reverse().map((e,i)=><div className="event" key={e.id||i}><div className="event-dot"/><div><b>{e.status.replaceAll('_',' ')}</b><span>{e.location||'Shipment facility'}</span></div></div>):<div className="event"><div className="event-dot"/><div><b>Shipment in transit</b><span>{current.name}</span></div></div>}
   <div className="event"><div className="event-dot future"/><div><b>Destination</b><span>{destination}</span></div></div>
  </div>
  <style jsx>{`
   .tracker-card{margin-top:18px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 2px 10px rgba(16,24,40,.06)}
   .summary{padding:18px 18px 14px;display:flex;justify-content:space-between;gap:15px}.eyebrow{font-size:9px;font-weight:800;letter-spacing:.12em;color:#667085}.summary h2{margin:5px 0 3px;font-size:20px}.summary p{margin:0;color:#667085;font-size:12px}.pill{height:max-content;padding:7px 9px;border-radius:20px;font-size:9px;font-weight:900;white-space:nowrap}.moving{color:#087443;background:#e9f8ef}.hold{color:#a15c00;background:#fff3d6}
   .route-bar{margin:0 18px 14px;padding:12px;border:1px solid #eaecf0;border-radius:9px;display:flex;align-items:center;justify-content:space-between}.route-bar div:not(.arrow){display:flex;flex-direction:column;gap:3px}.route-bar small{font-size:8px;color:#667085;font-weight:800}.route-bar b{font-size:11px}.arrow{font-size:18px;color:#98a2b3}
   .map{height:390px;position:relative;overflow:hidden;background:#f2f5f2;border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0}.map-title{position:absolute;z-index:8;left:12px;right:12px;top:12px;display:flex;justify-content:space-between;padding:9px 11px;background:rgba(255,255,255,.95);border-radius:8px;box-shadow:0 2px 8px rgba(16,24,40,.1)}.map-title b{font-size:11px}.map-title span{font-size:10px;color:#667085}.map-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(60,80,60,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(60,80,60,.055) 1px,transparent 1px);background-size:7% 10%}
   .map svg{position:absolute;inset:0;width:100%;height:100%;z-index:1}.route-bg{fill:none;stroke:white;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}.route-line{fill:none;stroke:#087443;stroke-width:1.2;stroke-dasharray:2.5 2;stroke-linecap:round;stroke-linejoin:round}
   .city{position:absolute;z-index:4;transform:translate(-50%,-50%)}.city i{display:block;width:6px;height:6px;border-radius:50%;background:#667085;border:2px solid white;box-shadow:0 0 0 1px #667085}.city span{position:absolute;left:9px;top:-7px;white-space:nowrap;font-size:9px;font-weight:700;color:#344054;text-shadow:0 1px 2px #fff}.city.origin i,.city.destination i{width:9px;height:9px;background:#087443;box-shadow:0 0 0 2px #fff,0 0 0 3px #087443}.city.origin span,.city.destination span{font-weight:900}.aircraft{position:absolute;z-index:7;font-size:28px;color:#087443;text-shadow:0 1px 4px white;transform-origin:center;transition:left .09s linear,top .09s linear}.hold-marker{position:absolute;z-index:7;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#a15c00;border:3px solid #d99a22;transform:translate(-50%,-50%);box-shadow:0 0 0 6px rgba(217,154,34,.16)}
   .legend{display:flex;gap:14px;padding:10px 14px;font-size:9px;color:#667085;border-bottom:1px solid #eaecf0}.legend span{display:flex;align-items:center;gap:5px}.legend i{display:inline-block}.green{width:14px;height:2px;background:#087443}.dot{width:7px;height:7px;border-radius:50%;background:#667085}.plane-dot{font-style:normal;color:#087443}.timeline{padding:15px 18px 18px}.timeline h3{margin:0 0 13px;font-size:14px}.event{position:relative;display:flex;gap:11px;padding:0 0 15px 18px;border-left:1px solid #d0d5dd}.event:last-child{border-left-color:transparent}.event-dot{position:absolute;left:-5px;top:0;width:9px;height:9px;border-radius:50%;background:#087443;border:2px solid white;box-shadow:0 0 0 1px #087443}.event-dot.future{background:#fff;border-color:#98a2b3;box-shadow:0 0 0 1px #98a2b3}.event b{display:block;font-size:11px;text-transform:capitalize}.event span{display:block;margin-top:3px;color:#667085;font-size:10px}
   @media(max-width:600px){.map{height:290px}.city span{font-size:7px}.city:not(.origin):not(.destination) span{display:none}.summary{padding:14px}.route-bar{margin:0 14px 12px}.legend{gap:8px;flex-wrap:wrap}.timeline{padding:14px}.aircraft{font-size:23px}}
  `}</style>
 </section>;
}
