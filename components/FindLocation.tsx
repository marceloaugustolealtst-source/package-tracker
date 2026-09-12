'use client'

import {useState} from 'react'
import './FindLocation.css'

export default function FindLocation(){
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 function find(){
  setError('')
  if(!navigator.geolocation){setError('Location is not available on this device.');return}
  setLoading(true)
  navigator.geolocation.getCurrentPosition(
   p=>{
    setLoading(false)
    const {latitude,longitude}=p.coords
    window.open(`https://www.google.com/maps/search/UPC+package+delivery+location/@${latitude},${longitude},13z`,'_blank','noopener,noreferrer')
   },
   ()=>{setLoading(false);setError('Please allow location access to find the closest location.')},
   {enableHighAccuracy:true,timeout:10000,maximumAge:300000}
  )
 }
 return <div className="find-location-wrap"><button className="find-location" onClick={find} disabled={loading} aria-label="Find closest UPC location"><span className="find-location-pin">⌖</span><span>{loading?'Finding location…':'Find Closest UPC Location'}</span><span className="find-location-chevron">⌄</span></button>{error&&<div className="find-location-error" role="alert">{error}</div>}</div>
}
