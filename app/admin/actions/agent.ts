'use server'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase-server'
import {redirect} from 'next/navigation'

async function admin(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user||user.app_metadata?.role!=='admin') redirect('/admin/login?error=unauthorized')
  return {supabase,user}
}

export async function updateAgentSettings(formData:FormData){
  const {supabase}=await admin()
  const agentOnline=formData.get('agent_online')==='on'
  const automatedReplies=formData.get('automated_replies')==='on'
  const typing=formData.get('typing')==='on'
  await supabase.from('support_settings').upsert({id:true,agent_online:agentOnline,automated_replies_enabled:automatedReplies,typing_enabled:typing,updated_at:new Date().toISOString()})
  revalidatePath('/admin/agent')
}

export async function sendAgentMessage(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  const body=String(formData.get('body')||'').trim()
  if(!conversationId||!body)return
  await supabase.from('support_messages').delete().eq('conversation_id',conversationId).eq('sender','bot').ilike('body','Checking your tracking number%')
  const {error}=await supabase.from('support_messages').insert({conversation_id:conversationId,sender:'agent',body})
  if(error)throw new Error(`Agent message failed: ${error.message}`)
  // Email notification is deliberately best-effort: a notification failure must never undo the chat message.
  try {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const secret=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    if(url&&secret){
      await fetch(`${url}/functions/v1/support-email-notification`,{method:'POST',headers:{'Content-Type':'application/json','x-internal-secret':secret},body:JSON.stringify({conversation_id:conversationId,message_id:(await supabase.from('support_messages').select('id').eq('conversation_id',conversationId).eq('sender','agent').order('created_at',{ascending:false}).limit(1).maybeSingle()).data?.id})}).catch(()=>{})
    }
  } catch {}
  await supabase.from('support_conversations').update({updated_at:new Date().toISOString(),automation_paused:true,automation_stage:'agent_takeover'}).eq('id',conversationId)
  revalidatePath('/admin/agent')
}

export async function setConversationAutomation(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  const paused=formData.get('paused')==='true'
  if(!conversationId)return
  await supabase.from('support_conversations').update({automation_paused:paused,updated_at:new Date().toISOString(),automation_stage:paused?'agent_takeover':'awaiting_tracking'}).eq('id',conversationId)
  revalidatePath('/admin/agent')
}

export async function closeConversation(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  if(!conversationId)return
  // Close first; then clear the visible conversation history. Neither failure is allowed to crash the page.
  const {error}=await supabase.from('support_conversations').update({status:'closed',automation_paused:true,automation_stage:'closed',updated_at:new Date().toISOString()}).eq('id',conversationId)
  if(!error)await supabase.from('support_messages').delete().eq('conversation_id',conversationId)
  revalidatePath('/admin/agent')
}
