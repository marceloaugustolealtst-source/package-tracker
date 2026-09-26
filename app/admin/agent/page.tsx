import Link from 'next/link'
import './agent.module.css'
import {createClient} from '@/lib/supabase-server'
import {createAdminClient} from '@/lib/supabase-admin'
import {updateAgentSettings,sendAgentMessage,setConversationAutomation,closeConversation,deleteSupportMessage} from '../actions/agent'
import AgentInbox from './AgentInbox'

export const dynamic='force-dynamic'

export default async function AgentControl(){
  const supabase=await createClient()
  const adminDb=createAdminClient()
  const settingsDb=adminDb||supabase
  const {data:settings}=await settingsDb.from('support_settings').select('*').eq('id',true).maybeSingle()

  // Support data is read with the server-only admin/secret client so RLS on the
  // customer chat tables cannot hide guest or registered conversations from an
  // authenticated support agent. The secret key never reaches the browser.
  const {data:rows}=await settingsDb.from('support_conversations').select('*').neq('status','closed').order('updated_at',{ascending:false}).limit(100)
  const conversations=rows||[]
  const ids=conversations.map((c:any)=>c.id).filter(Boolean)
  let messages:any[]=[]
  if(ids.length){
    const result=await settingsDb.from('support_messages').select('id,conversation_id,sender,body,created_at').in('conversation_id',ids).order('created_at',{ascending:true}).limit(2000)
    messages=result.data||[]
  }
  const messageMap=new Map<string,any[]>()
  for(const m of messages){const list=messageMap.get(m.conversation_id)||[];list.push(m);messageMap.set(m.conversation_id,list)}
  const inboxConversations=conversations.map((c:any)=>({
    ...c,
    support_messages:messageMap.get(c.id)||[],
    customer_type:c.user_id?'Registered customer':'Guest customer'
  }))

  const online=settings?.agent_online??true
  const automated=settings?.automated_replies_enabled??true
  const typing=settings?.typing_enabled??true
  return <main className="container admin agent-admin">
    <header className="admin-head"><div><div className="eyebrow">CUSTOMER SUPPORT</div><h1>WhatsApp-style Agent Inbox</h1><p>Choose a guest or registered customer, read the conversation, and reply directly like WhatsApp.</p></div><Link className="btn btn-light" href="/admin">Back to admin</Link></header>
    <section className="agent-control-grid">
      <form action={updateAgentSettings} className="card agent-settings"><div className="list-head"><div><span className="muted">AGENT STATUS</span><h2>Support availability</h2></div><span className={online?'agent-status online':'agent-status offline'}>{online?'● Online':'● Offline'}</span></div><label className="control-toggle"><input type="checkbox" name="agent_online" defaultChecked={online}/><span><b>Agent available</b><small>Show the Agent as ready to help customers.</small></span></label><label className="control-toggle"><input type="checkbox" name="automated_replies" defaultChecked={automated}/><span><b>Automated replies</b><small>Allow automated replies when a conversation is not paused.</small></span></label><label className="control-toggle"><input type="checkbox" name="typing" defaultChecked={typing}/><span><b>Typing indicator</b><small>Show a realistic typing state before automated replies.</small></span></label><button className="btn btn-primary">Save agent settings</button></form>
      <section className="card agent-guide"><span className="muted">HOW TO REPLY</span><h2>WhatsApp-style support</h2><p>Guest and registered customer conversations appear in the message list. Select one to open the full chat on the right and reply directly.</p><div className="agent-rule"><b>1. Choose a customer</b><span>Tap any guest or registered customer.</span></div><div className="agent-rule"><b>2. Read the chat</b><span>Customer messages appear on the left and your replies on the right.</span></div><div className="agent-rule"><b>3. Reply</b><span>Type in the message box and press send.</span></div></section>
    </section>
    <section className="card conversations"><AgentInbox conversations={inboxConversations as any} sendAgentMessage={sendAgentMessage} setConversationAutomation={setConversationAutomation} closeConversation={closeConversation} deleteSupportMessage={deleteSupportMessage}/></section>
  </main>
}
