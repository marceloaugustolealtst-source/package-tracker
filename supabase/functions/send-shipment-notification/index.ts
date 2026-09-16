import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

const esc=(v:string)=>v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try{
    const body=await req.json()
    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const{data:shipment,error}=await supabase.from('shipments').select('tracking_number,recipient_name,recipient_email,origin,destination,status,estimated_delivery').eq('id',body.shipment_id).single()
    if(error||!shipment?.recipient_email) throw new Error(error?.message||'Recipient email is missing')
    const apiKey=Deno.env.get('RESEND_API_KEY')
    const from=Deno.env.get('RESEND_FROM_EMAIL')||'UPC <onboarding@resend.dev>'
    if(!apiKey) throw new Error('RESEND_API_KEY is not configured')
    const status=String(body.status||shipment.status).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase())
    const tracking=esc(shipment.tracking_number)
    const name=esc(shipment.recipient_name||'Customer')
    const location=esc(String(body.location||''))
    const description=esc(String(body.description||'Your shipment has been updated by UPC operations.'))
    const trackUrl=`${Deno.env.get('PUBLIC_SITE_URL')||'https://package-tracker-sigma.vercel.app'}/track/${encodeURIComponent(shipment.tracking_number)}`
    const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>UPC Shipment Update</h2><p>Hello ${name},</p><p>Your shipment <strong>${tracking}</strong> has a new update.</p><div style="padding:18px;border:1px solid #ddd;border-radius:10px"><p><strong>Status:</strong> ${esc(status)}</p>${location?`<p><strong>Location:</strong> ${location}</p>`:''}<p><strong>Update:</strong> ${description}</p>${shipment.estimated_delivery?`<p><strong>Estimated delivery:</strong> ${esc(shipment.estimated_delivery)}</p>`:''}</div><p><a href="${trackUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Track shipment</a></p><p>Regards,<br>UPC Operations</p></div>`
    const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[shipment.recipient_email],subject:`UPC shipment update — ${shipment.tracking_number}: ${status}`,html})})
    const result=await res.json()
    if(!res.ok) throw new Error(result?.message||'Email provider rejected the request')
    return new Response(JSON.stringify({ok:true,id:result.id}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})}
})
