import Link from 'next/link'
import './agent.module.css'
import {createClient} from '@/lib/supabase-server'
import {updateAgentSettings,sendAgentMessage,setConversationAutomation,closeConversation} from '../actions/agent'

export const dynamic='force-dynamic'

export default async function AgentControl(){
  const supabase=await createClient()
  const {data:settings}=await supabase.from('support_settings').select('*').eq('id',true).maybeSingle()
  const {data:conversations}=await supabase.from('support_conversations').select('*,support_messages(*)').neq('status','closed').order('updated_at',{ascending:false}).limit(50)
  const online=settings?.agent_online??true
  const automated=settings?.automated_replies_enabled??true
  const typing=settings?.typing_enabled??true
  return <main className="container admin agent-admin">
    <header className="admin-head"><div><div className="eyebrow">CUSTOMER SUPPORT</div><h1>WhatsApp-style Agent Inbox</h1><p>Reply to customers in a clear chat layout. Customer messages stay on the left and your replies stay on the right.</p></div><Link className="btn btn-light" href="/admin">Back to admin</Link></header>
    <section className="agent-control-grid">
      <form action={updateAgentSettings} className="card agent-settings">
        <div className="list-head"><div><span className="muted">AGENT STATUS</span><h2>Support availability</h2></div><span className={online?'agent-status online':'agent-status offline'}>{online?'● Online':'● Offline'}</span></div>
        <label className="control-toggle"><input type="checkbox" name="agent_online" defaultChecked={online}/><span><b>Agent available</b><small>Show the Agent as ready to help customers.</small></span></label>
        <label className="control-toggle"><input type="checkbox" name="automated_replies" defaultChecked={automated}/><span><b>Automated replies</b><small>Allow the automated agent to reply when a conversation is not paused.</small></span></label>
        <label className="control-toggle"><input type="checkbox" name="typing" defaultChecked={typing}/><span><b>Typing indicator</b><small>Show a realistic typing state before automated replies.</small></span></label>
        <button className="btn btn-primary">Save agent settings</button>
      </form>
      <section className="card agent-guide"><span className="muted">QUICK CONTROL</span><h2>Agent controls</h2><p>Send a reply to take over a conversation. Resume automation when you want the automated agent to continue.</p><div className="agent-rule"><b>Reply to customer</b><span>Your message appears on the right like WhatsApp.</span></div><div className="agent-rule"><b>Pause automation</b><span>Keep the human agent in control.</span></div><div className="agent-rule"><b>Close chat</b><span>The conversation disappears from the inbox and its messages are no longer shown.</span></div></section>
    </section>
    <section className="card conversations"><div className="list-head"><div><span className="muted">LIVE INBOX</span><h2>Chats</h2><p className="muted">Open conversations only. Closed chats are removed from this screen.</p></div><span className="inbox-count">{conversations?.length||0} active chats</span></div>
      {!conversations?.length?<div className="empty agent-empty">No active customer chats. New support conversations will appear here.</div>:<div className="conversation-list">{conversations.map((c:any)=>{const messages=[...(c.support_messages||[])].sort((a:any,b:any)=>+new Date(a.created_at)-+new Date(b.created_at));return <article className="conversation" key={c.id}><div className="conversation-head"><div><b>{c.customer_name||'Customer'}</b><small>{c.customer_email||c.session_id}</small></div><div className="conversation-state"><span className={c.automation_paused?'paused':'active'}>{c.automation_paused?'Manual mode':'Automation on'}</span><span>● Active</span></div></div><div className="message-history">{messages.map((m:any)=><div className={'support-message '+m.sender} key={m.id}><span>{m.sender==='bot'?'Agent':'You'&&m.sender==='agent'?'You':'Customer'}</span><p>{m.body}</p><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>)}</div><form action={sendAgentMessage} className="agent-compose"><input type="hidden" name="conversation_id" value={c.id}/><textarea name="body" placeholder="Type a message…" required rows={1}/><button className="btn btn-primary">Send</button></form><div className="conversation-actions">{c.automation_paused?<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={c.id}/><input type="hidden" name="paused" value="false"/><button className="btn btn-light">Resume automation</button></form>:<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={c.id}/><input type="hidden" name="paused" value="true"/><button className="btn btn-light">Pause automation</button></form>}<form action={closeConversation}><input type="hidden" name="conversation_id" value={c.id}/><button className="btn btn-light">Close chat</button></form></div></article>})}</div>}
    </section>
  </main>
}
