import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) throw new Error('Missing Supabase server credentials')
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json()
    const conversationId=String(body.conversation_id||'')
    const message=String(body.message||'').trim()
    const sender=body.sender==='agent'?'agent':'customer'
    if(!conversationId||!message) return NextResponse.json({error:'conversation_id and message are required'},{status:400})
    const supabase=getAdminClient()
    const {data:conversation,error:conversationError}=await supabase.from('support_conversations').select('id,status').eq('id',conversationId).maybeSingle()
    if(conversationError) throw conversationError
    if(!conversation) return NextResponse.json({error:'Conversation not found'},{status:404})
    if(conversation.status==='closed') return NextResponse.json({error:'Conversation is closed'},{status:409})
    const {data:created,error}=await supabase.from('support_messages').insert({conversation_id:conversationId,sender,body:message}).select('id,conversation_id,sender,body,created_at').single()
    if(error) throw error
    await supabase.from('support_conversations').update({updated_at:new Date().toISOString(),...(sender==='agent'?{automation_paused:true,automation_stage:'agent_takeover'}:{})}).eq('id',conversationId)
    return NextResponse.json({message:created})
  }catch(error){
    console.error('support chat error',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Unable to send message'},{status:500})
  }
}
