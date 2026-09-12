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
  const {error}=await supabase.from('support_settings').upsert({id:true,agent_online:agentOnline,automated_replies_enabled:automatedReplies,typing_enabled:typing,updated_at:new Date().toISOString()})
  if(error) throw new Error(error.message)
  revalidatePath('/admin/agent')
}

export async function sendAgentMessage(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  const body=String(formData.get('body')||'').trim()
  if(!conversationId||!body) return
  // The temporary automated "Checking…" message is removed as soon as a human agent takes over.
  await supabase.from('support_messages').delete().eq('conversation_id',conversationId).eq('sender','bot').ilike('body','Checking your tracking number%')
  const {error}=await supabase.from('support_messages').insert({conversation_id:conversationId,sender:'agent',body})
  if(error) throw new Error(error.message)
  await supabase.from('support_conversations').update({updated_at:new Date().toISOString(),automation_paused:true,automation_stage:'agent_takeover'}).eq('id',conversationId)
  revalidatePath('/admin/agent')
}

export async function setConversationAutomation(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  const paused=formData.get('paused')==='true'
  if(!conversationId) return
  const {error}=await supabase.from('support_conversations').update({automation_paused:paused,updated_at:new Date().toISOString(),automation_stage:paused?'agent_takeover':'awaiting_tracking'}).eq('id',conversationId)
  if(error) throw new Error(error.message)
  revalidatePath('/admin/agent')
}

export async function closeConversation(formData:FormData){
  const {supabase}=await admin()
  const conversationId=String(formData.get('conversation_id')||'')
  if(!conversationId) return
  const {error}=await supabase.from('support_conversations').update({status:'closed',automation_paused:true,automation_stage:'agent_takeover',updated_at:new Date().toISOString()}).eq('id',conversationId)
  if(error) throw new Error(error.message)
  revalidatePath('/admin/agent')
}