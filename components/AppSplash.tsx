'use client'

import {useEffect,useState} from 'react'
import './AppSplash.css'

export default function AppSplash(){
 const [visible,setVisible]=useState(true)
 useEffect(()=>{const timer=window.setTimeout(()=>setVisible(false),1200);return()=>window.clearTimeout(timer)},[])
 if(!visible)return null
 return <div className="upc-splash" role="status" aria-label="Loading UPC Package Tracker"><div className="upc-splash-card"><div className="upc-splash-logo">UPC</div><div className="upc-splash-title">Package Tracker</div><div className="upc-splash-loader"><span/><span/><span/></div><div className="upc-splash-text">Loading…</div></div></div>
}
