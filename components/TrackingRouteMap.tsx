'use client';
import { useEffect, useMemo, useState } from 'react';

type Event={id:string;location:string|null;status:string};
type Point={name:string;x:number;y:number};

const cities:Point[]=[
  {name:'Toronto',x:12,y:18},{name:'New York',x:18,y:27},{name:'London',x:48,y:20},
  {name:'Paris',x:51,y:27},{name:'Cairo',x:59,y:39},{name:'Dubai',x:65,y:43},
  {name:'Mumbai',x:72,y:56},{name:'Lagos',x:39,y:58},{name:'Nairobi',x:55,y:67},
  {name:'Johannesburg',x:45,y:78},{name:'São Paulo',x:25,y:78},{name:'Singapore',x:82,y:72},
  {name:'Tokyo',x:91,y:34},{name:'Sydney',x:88,y:88},{name:'Warsaw',x:55,y:22}
];

const city=(value:string)=>{
  const text=value.toLowerCase();
  return cities.find(c=>text.includes(c.name.toLowerCase()))||null;
};

const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

export default function TrackingRouteMap({origin,destination,status,events}:{origin:string;destination:string;status:string;events:Event[]}){
  const start=useMemo(()=>city(origin)||cities.find(c=>c.name==='Lagos')!,[origin]);
  const end=useMemo(()=>city(destination)||cities.find(c=>c.name==='Warsaw')!,[destination]);

  const route=useMemo(()=>{
    const candidates=cities
      .filter(c=>c.name!==start.name&&c.name!==end.name)
      .filter(c=>{
        const total=distance(start,end);
        const via=distance(start,c)+distance(c,end);
        return via<=total*1.55;
      })
      .sort((a,b)=>distance(start,a)-distance(start,b));

    const waypoints=[start];
    const count=Math.min(3,candidates.length);
    for(let i=0;i<count;i++){
      const index=Math.floor((i+1)*(candidates.length/(count+1)));
      if(candidates[index])waypoints.push(candidates[index]);
    }
    waypoints.push(end);
    return waypoints;
  },[start,end]);

  const stopped=['processing','at_hub','exception','delivered'].includes(status);
  const [progress,setProgress]=useState(0);

  useEffect(()=>{
    if(stopped)return;
    const timer=setInterval(()=>setProgress(v=>v>=route.length-1?0:v+0.004),90);
    return()=>clearInterval(timer);
  },[stopped,route.length]);

  const segment=Math.min(Math.floor(progress),route.length-2);
  const local=progress-segment;
  const from=route[segment]||route[0];
  const to=route[segment+1]||route[1]||route[0];
  const x=from.x+(to.x-from.x)*local;
  const y=from.y+(to.y-from.y)*local;
  const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
  const current=stopped?(status==='delivered'?end:route[Math.min(segment,route.length-1)]):from;

  return <section className="card route-card">
    <div className="route-head">
      <div><b>{stopped?'Package checkpoint':'Package in transit'}</b><small>{stopped?`Held at ${current.name}`:`Currently passing ${current.name}`}</small></div>
      <span className={stopped?'checkpoint':'live'}>{stopped?'CHECKPOINT':'MOVING LIVE'}</span>
    </div>
    <div className="route-map" aria-label={`Shipment route from ${origin} to ${destination}`}>
      <div className="route-grid"/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-shadow" d={`M ${route.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}`}/>
        <path className="route-path" d={`M ${route.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}`}/>
      </svg>
      {cities.map(c=><div key={c.name} className={`city ${route.some(r=>r.name===c.name)?'on-route':''}`} style={{left:`${c.x}%`,top:`${c.y}%`}}>
        <i/>
        <span>{c.name}</span>
      </div>)}
      <div className="route-end from"><b>FROM</b><strong>{origin}</strong></div>
      <div className="route-end to"><b>TO</b><strong>{destination}</strong></div>
      {!stopped&&<div className="plane" style={{left:`${x}%`,top:`${y}%`,transform:`translate(-50%,-50%) rotate(${angle}deg)`}}>✈</div>}
      {stopped&&<div className="checkpoint-marker" style={{left:`${current.x}%`,top:`${current.y}%`}}>!</div>}
    </div>
    <div className="route-status"><b>{stopped?'CHECKPOINT':'TRANSIT'}</b><span>{stopped?`Package is being held at ${current.name}`:`Route: ${current.name} → ${to.name}`}</span></div>
    <style jsx>{`
      .route-card{margin-top:18px}.route-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}.route-head b{display:block;font-size:15px}.route-head small{display:block;margin-top:4px;color:#667085;font-size:11px}.route-head span{font-size:10px;font-weight:900;letter-spacing:.08em}.live{color:#16a34a}.checkpoint{color:#d97706}.route-map{height:380px;position:relative;overflow:hidden;border-radius:12px;background:#eef3ee;border:1px solid #d7ded7}.route-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(80,100,80,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(80,100,80,.08) 1px,transparent 1px);background-size:8% 12%}.route-map svg{position:absolute;inset:0;width:100%;height:100%;z-index:1}.route-shadow{fill:none;stroke:rgba(255,255,255,.95);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.route-path{fill:none;stroke:#16a34a;stroke-width:1.3;stroke-dasharray:3 2;stroke-linecap:round;stroke-linejoin:round}.city{position:absolute;z-index:3;transform:translate(-50%,-50%);pointer-events:none}.city i{display:block;width:5px;height:5px;border-radius:50%;background:#777;border:1px solid white;box-shadow:0 0 0 1px #777}.city.on-route i{width:8px;height:8px;background:#16a34a;box-shadow:0 0 0 2px white,0 0 0 3px #16a34a}.city span{position:absolute;left:8px;top:-7px;white-space:nowrap;font-size:9px;font-weight:700;color:#344054;text-shadow:0 1px 2px white}.route-end{position:absolute;z-index:5;top:10px;padding:7px 9px;border-radius:7px;background:rgba(255,255,255,.94);box-shadow:0 2px 8px rgba(0,0,0,.1)}.route-end b{display:block;font-size:8px;letter-spacing:.08em;color:#16a34a}.route-end strong{display:block;font-size:10px;color:#351c15}.route-end.from{left:10px}.route-end.to{right:10px}.plane{position:absolute;z-index:6;font-size:27px;color:#16a34a;text-shadow:0 1px 3px white;transform-origin:center;transition:left .09s linear,top .09s linear}.checkpoint-marker{position:absolute;z-index:7;width:28px;height:28px;border-radius:50%;background:#d97706;color:white;font-weight:900;display:grid;place-items:center;transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(217,119,6,.18),0 2px 7px rgba(0,0,0,.2)}.route-status{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:11px}.route-status b{font-size:9px;letter-spacing:.06em}.route-status span{color:#667085}@media(max-width:600px){.route-map{height:280px}.city span{font-size:7px}.city:not(.on-route) span{display:none}.route-end{padding:5px 7px}.route-end strong{font-size:8px}.plane{font-size:22px}}
    `}</style>
  </section>;
}
