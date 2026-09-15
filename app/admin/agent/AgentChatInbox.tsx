'use client'

import {useMemo,useState} from 'react'
import {sendAgentMessage,setConversationAutomation,closeConversation} from '../actions/agent'

type Message={id:string;sender:string;body:string;created_at:string}
type Conversation={id:string;customer_name?:string|null;customer_email?:string|null;session_id?:string|null;automation_paused?:boolean;support_messages?:Message[]}

export default function AgentChatInbox({conversations}:{conversations:Conversation[]}){
  const sorted=useMemo(()=>conversations.map(c=>({...c,support_messages:[...(c.support_messages||[])].sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at))})),[conversations])
  const [selectedId,setSelectedId]=useState(sorted[0]?.id||'')
  const selected=sorted.find(c=>c.id===selectedId)||sorted[0]
  const lastMessage=(c:Conversation)=>c.support_messages?.[c.support_messages.length-1]

  if(!sorted.length) return <div className="wa-empty">No active customer chats. New support conversations will appear here.</div>

  return <div className="wa-inbox">
    <aside className="wa-chat-list">
      <div className="wa-list-header"><div><b>Chats</b><span>{sorted.length} active</span></div><span className="wa-online">● Online</span></div>
      <div className="wa-list-body">
        {sorted.map(c=>{const last=lastMessage(c);const active=c.id===(selected?.id||'');return <button type="button" className={`wa-chat-row ${active?'selected':''}`} key={c.id} onClick={()=>setSelectedId(c.id)}>
          <span className="wa-avatar">{(c.customer_name||'C').slice(0,1).toUpperCase()}</span>
          <span className="wa-chat-meta"><b>{c.customer_name||'Customer'}</b><small>{last?.body||'No messages yet'}</small></span>
          <span className="wa-chat-time">{last?new Date(last.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}</span>
        </button>})}
      </div>
    </aside>

    {selected&&<section className="wa-chat-window">
      <header className="wa-chat-header">
        <span className="wa-avatar large">{(selected.customer_name||'C').slice(0,1).toUpperCase()}</span>
        <div><b>{selected.customer_name||'Customer'}</b><small>{selected.customer_email||selected.session_id||'Customer support chat'}</small></div>
        <span className="wa-chat-status">● Active</span>
      </header>

      <div className="wa-messages">
        {selected.support_messages?.map(m=><div className={`wa-message ${m.sender==='agent'?'outgoing':'incoming'}`} key={m.id}>
          <div className="wa-bubble"><span className="wa-sender">{m.sender==='agent'?'You':m.sender==='bot'?'UPC Support':'Customer'}</span><p>{m.body}</p><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>
        </div>)}
        {!selected.support_messages?.length&&<div className="wa-no-messages">No messages yet. Send the first reply.</div>}
      </div>

      <form action={sendAgentMessage} className="wa-composer">
        <input type="hidden" name="conversation_id" value={selected.id}/>
        <textarea name="body" placeholder="Type a message" required rows={1}/>
        <button type="submit" aria-label="Send message">➤</button>
      </form>

      <div className="wa-chat-actions">
        {selected.automation_paused?<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={selected.id}/><input type="hidden" name="paused" value="false"/><button type="submit">Resume automation</button></form>:<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={selected.id}/><input type="hidden" name="paused" value="true"/><button type="submit">Pause automation</button></form>}
        <form action={closeConversation}><input type="hidden" name="conversation_id" value={selected.id}/><button type="submit" className="close">Close conversation</button></form>
      </div>
    </section>}
  </div>
}
