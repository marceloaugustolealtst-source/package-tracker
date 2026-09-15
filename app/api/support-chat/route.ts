import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) throw new Error('Support chat server database key is not configured')
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
}

async function getOrCreateConversation(supabase:any,sessionId:string){
  if(!sessionId) throw new Error('Missing session id')
  const found=await supabase.from('support_conversations').select('*').eq('session_id',sessionId).neq('status','closed').order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(found.error) throw found.error
  if(found.data) return found.data
  const created=await supabase.from('support_conversations').insert({session_id:sessionId,status:'open',automation_stage:'awaiting_tracking',automation_paused:false,updated_at:new Date().toISOString()}).select('*').single()
  if(created.error) throw created.error
  return created.data
}

export async function POST(req:Request){
  try{
    const body=await req.json()
    const action=String(body?.action||'')
    const supabase=adminClient()
    if(action==='ensure'){
      const sessionId=String(body?.session_id||'').trim()
      const conversation=await getOrCreateConversation(supabase,sessionId)
      const existing=await supabase.from('support_messages').select('id').eq('conversation_id',conversation.id).limit(1)
      if(existing.error) throw existing.error
      if(!existing.data?.length){
        const greeting=await supabase.from('support_messages').insert({conversation_id:conversation.id,sender:'bot',body:'Hello! I’m the UPC Support Agent. If you want to track your package, please send your tracking number.'})
        if(greeting.error) throw greeting.error
      }
      const messages=await supabase.from('support_messages').select('id,sender,body,created_at').eq('conversation_id',conversation.id).order('created_at',{ascending:true})
      if(messages.error) throw messages.error
      return NextResponse.json({conversation,messages:messages.data||[]})
    }
    if(action==='messages'){
      const conversationId=String(body?.conversation_id||'').trim()
      if(!conversationId) return NextResponse.json({error:'Missing conversation id'},{status:400})
      const conversation=await supabase.from('support_conversations').select('*').eq('id',conversationId).maybeSingle()
      if(conversation.error) throw conversation.error
      if(!conversation.data) return NextResponse.json({error:'Conversation not found'},{status:404})
      const messages=await supabase.from('support_messages').select('id,sender,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true})
      if(messages.error) throw messages.error
      return NextResponse.json({conversation:conversation.data,messages:messages.data||[]})
    }
    if(action==='send'||action==='bot'){
      const conversationId=String(body?.conversation_id||'').trim()
      const sessionId=String(body?.session_id||'').trim()
      const text=String(body?.body||'').trim()
      if(!text) return NextResponse.json({error:'Missing message body'},{status:400})
      let conversation:any=null
      if(conversationId){
        const found=await supabase.from('support_conversations').select('*').eq('id',conversationId).maybeSingle()
        if(found.error) throw found.error
        conversation=found.data
      }
      if(!conversation&&sessionId) conversation=await getOrCreateConversation(supabase,sessionId)
      if(!conversation) return NextResponse.json({error:'Conversation not found; send a valid session id'},{status:404})
      if(conversation.status==='closed') return NextResponse.json({error:'Conversation is closed'},{status:409})
      const sender=action==='bot'?'bot':'customer'
      const inserted=await supabase.from('support_messages').insert({conversation_id:conversation.id,sender,body:text}).select('id,conversation_id,sender,body,created_at').single()
      if(inserted.error) throw inserted.error
      const updated=await supabase.from('support_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation.id)
      if(updated.error) throw updated.error
      return NextResponse.json({conversation_id:conversation.id,message:inserted.data})
    }
    if(action==='update'){
      const conversationId=String(body?.conversation_id||'').trim()
      const patch=body?.patch||{}
      if(!conversationId) return NextResponse.json({error:'Missing conversation id'},{status:400})
      const allowed=['tracking_number','automation_stage','automation_paused','updated_at','status']
      const clean=Object.fromEntries(Object.entries(patch).filter(([key])=>allowed.includes(key)))
      const updated=await supabase.from('support_conversations').update(clean).eq('id',conversationId).select('*').single()
      if(updated.error) throw updated.error
      return NextResponse.json({conversation:updated.data})
    }
    if(action==='lookup'){
      const trackingNumber=String(body?.tracking_number||'').trim()
      const result=await supabase.rpc('get_tracking_package',{p_tracking_number:trackingNumber})
      if(result.error) throw result.error
      return NextResponse.json({packages:result.data||[]})
    }
    return NextResponse.json({error:'Unknown support chat action'},{status:400})
  }catch(error:any){
    console.error('support-chat',error)
    return NextResponse.json({error:error?.message||'Support chat request failed'},{status:500})
  }
}
