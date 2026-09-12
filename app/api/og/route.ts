import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }

export default function GET() {
  return new ImageResponse(
    (
      <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#f4f2ef',fontFamily:'Arial'}}>
        <div style={{height:430,display:'flex',flexDirection:'column',background:'#351c15',padding:'70px 90px',position:'relative',color:'#fff'}}>
          <div style={{position:'absolute',right:-60,top:-100,width:330,height:330,borderRadius:9999,background:'#ffca05',opacity:.12}} />
          <div style={{width:112,height:82,borderRadius:14,background:'#ffca05',display:'flex',alignItems:'center',justifyContent:'center',color:'#351c15',fontSize:42,fontWeight:900}}>UPC</div>
          <div style={{marginTop:42,fontSize:58,fontWeight:800,lineHeight:1.05}}>UPC Package Tracker</div>
          <div style={{marginTop:22,fontSize:27,color:'#f8eee8'}}>Track your delivery with real-time shipment updates.</div>
          <div style={{marginTop:30,width:300,height:64,borderRadius:10,background:'#ffca05',display:'flex',alignItems:'center',justifyContent:'center',color:'#351c15',fontSize:23,fontWeight:800}}>Track your package</div>
        </div>
        <div style={{height:200,display:'flex',flexDirection:'column',justifyContent:'center',padding:'0 90px',background:'#fff',color:'#351c15'}}>
          <div style={{fontSize:21,fontWeight:700}}>Fast delivery • Live tracking • Delivery alerts</div>
          <div style={{marginTop:18,fontSize:18,color:'#6d625c'}}>upctracker.site</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
