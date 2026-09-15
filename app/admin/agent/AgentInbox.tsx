'use client'

import {useMemo,useState} from 'react'
import type {ReactNode} from 'react'

type Conversation={id:string;customer_name?:string|null;customer_email?:string|null;session_id?:string|null;automation_paused?:boolean;support_messages:any[]}
type Action=(formData:FormData)=>void|Promise<void>

export default function AgentInbox({conversations,sendAgentMessage,setConversationAutomation,closeConversation}:{conversations:Conversation[];sendAgentMessage:Action;setConversationAutomation:Action;closeConversation:Action}){
  const [selectedId,setSelectedId]=useState(conversations[0]?.id||'')
  const selected=useMemo(()=>conversations.find(c=>c.id===selectedId)||conversations[0], [conversations,selectedId])
  const messages=[...(selected?.support_messages||[])].sort((a:any,b:any)=>+new Date(a.created_at)-+new Date(b.created_at))
  return <div className="wa-inbox">
    <aside className="wa-sidebar">
      <div className="wa-sidebar-head"><div><span className="muted">LIVE INBOX</span><h2>Messages</h2></div><span className="inbox-count">{conversations.length}</span></div>
      <div className="wa-chat-list">{conversations.map(c=>{const ms=[...(c.support_messages||[])].sort((a:any,b:any)=>+new Date(b.created_at)-+new Date(a.created_at));const last=ms[0];return <button type="button" className={'wa-chat-row '+(selected?.id===c.id?'selected':'')} key={c.id} onClick={()=>setSelectedId(c.id)}><span className="wa-avatar">{(c.customer_name||'C').slice(0,1).toUpperCase()}</span><span className="wa-chat-main"><b>{c.customer_name||'Customer'}</b><small>{last?.body||'New customer conversation'}</small></span><span className="wa-chat-time">{last?.created_at?new Date(last.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}</span></button>})}</div>
    </aside>
    <section className="wa-window">{selected?<><header className="wa-header"><span className="wa-avatar header-avatar">{(selected.customer_name||'C').slice(0,1).toUpperCase()}</span><div><b>{selected.customer_name||'Customer'}</b><small>{selected.customer_email||selected.session_id||'Customer support'}</small></div><span className="wa-online">● Active</span></header><div className="wa-messages">{messages.map((m:any)=><div className={'wa-row '+(m.sender==='agent'?'outgoing':'incoming')} key={m.id}><div className={'wa-bubble '+m.sender}><span className="wa-sender">{m.sender==='agent'?'You':m.sender==='bot'?'Agent':'Customer'}</span><div>{m.body}</div><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>)}</div><form action={sendAgentMessage} className="wa-composer"><input type="hidden" name="conversation_id" value={selected.id}/><textarea name="body" placeholder="Type a message" required rows={1}/><button className="wa-send" type="submit">➤</button></form><div className="wa-actions">{selected.automation_paused?<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={selected.id}/><input type="hidden" name="paused" value="false"/><button type="submit">Resume automation</button></form>:<form action={setConversationAutomation}><input type="hidden" name="conversation_id" value={selected.id}/><input type="hidden" name="paused" value="true"/><button type="submit">Pause automation</button></form>}<form action={closeConversation}><input type="hidden" name="conversation_id" value={selected.id}/><button type="submit">Close chat</button></form></div></>:<div className="wa-empty"><b>Select a customer</b><span>Choose a conversation from the message list to reply.</span></div>}</section>
  </div>
}
