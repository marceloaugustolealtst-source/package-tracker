import Link from 'next/link'
import './agent.module.css'
import {createClient} from '@/lib/supabase-server'
import {updateAgentSettings,sendAgentMessage,setConversationAutomation,closeConversation} from '../actions/agent'
import AgentInbox from './AgentInbox'

export const dynamic='force-dynamic'

export default async function AgentControl(){
  const supabase=await createClient()
  const {data:settings}=await supabase.from('support_settings').select('*').eq('id',true).maybeSingle()
  const {data:conversations}=await supabase.from('support_conversations').select('*,support_messages(*)').neq('status','closed').order('updated_at',{ascending:false}).limit(50)
  const online=settings?.agent_online??true
  const automated=settings?.automated_replies_enabled??true
  const typing=settings?.typing_enabled??true
  return <main className="container admin agent-admin">
    <header className="admin-head"><div><div className="eyebrow">CUSTOMER SUPPORT</div><h1>WhatsApp-style Agent Inbox</h1><p>Choose a customer from the message list, read the conversation, and reply like WhatsApp.</p></div><Link className="btn btn-light" href="/admin">Back to admin</Link></header>
    <section className="agent-control-grid">
      <form action={updateAgentSettings} className="card agent-settings"><div className="list-head"><div><span className="muted">AGENT STATUS</span><h2>Support availability</h2></div><span className={online?'agent-status online':'agent-status offline'}>{online?'● Online':'● Offline'}</span></div><label className="control-toggle"><input type="checkbox" name="agent_online" defaultChecked={online}/><span><b>Agent available</b><small>Show the Agent as ready to help customers.</small></span></label><label className="control-toggle"><input type="checkbox" name="automated_replies" defaultChecked={automated}/><span><b>Automated replies</b><small>Allow automated replies when a conversation is not paused.</small></span></label><label className="control-toggle"><input type="checkbox" name="typing" defaultChecked={typing}/><span><b>Typing indicator</b><small>Show a realistic typing state before automated replies.</small></span></label><button className="btn btn-primary">Save agent settings</button></form>
      <section className="card agent-guide"><span className="muted">HOW TO REPLY</span><h2>WhatsApp-style support</h2><p>Customer conversations appear in the left message list. Select one to open the full chat on the right and reply directly.</p><div className="agent-rule"><b>1. Choose a customer</b><span>Tap a conversation in the Messages list.</span></div><div className="agent-rule"><b>2. Read the chat</b><span>Customer messages appear on the left and your replies on the right.</span></div><div className="agent-rule"><b>3. Reply</b><span>Type in the message box and press the send button.</span></div></section>
    </section>
    <section className="card conversations"><AgentInbox conversations={(conversations||[]) as any} sendAgentMessage={sendAgentMessage} setConversationAutomation={setConversationAutomation} closeConversation={closeConversation}/></section>
  </main>
}
