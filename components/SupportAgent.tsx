'use client'

import {useEffect,useMemo,useState} from 'react'
import {createClient} from '@/lib/supabase-browser'
import './SupportAgent.css'

type Message={id:string;sender:'customer'|'agent'|'bot';body:string;created_at:string}
type Conversation={id:string;session_id:string;automation_stage:string;automation_paused:boolean;tracking_number?:string|null}

const SESSION_KEY='upc-support-session'

function getSession(){
  let id=localStorage.getItem(SESSION_KEY)
  if(!id){id=crypto.randomUUID();localStorage.setItem(SESSION_KEY,id)}
  return id
}

export default function SupportAgent(){
  const supabase=useMemo(()=>createClient(),[])
  const [open,setOpen]=useState(false)
  const [session,setSession]=useState('')
  const [conversation,setConversation]=useState<Conversation|null>(null)
  const [messages,setMessages]=useState<Message[]>([])
  const [text,setText]=useState('')
  const [typing,setTyping]=useState(false)
  const [busy,setBusy]=useState(false)

  async function loadMessages(id:string){
    const {data}=await supabase.from('support_messages').select('id,sender,body,created_at').eq('conversation_id',id).order('created_at',{ascending:true})
    setMessages((data||[]) as Message[])
  }

  async function ensureConversation(){
    const sid=getSession();setSession(sid)
    let {data}=await supabase.from('support_conversations').select('*').eq('session_id',sid).maybeSingle()
    if(!data){
      const created=await supabase.from('support_conversations').insert({session_id:sid,status:'open',automation_stage:'awaiting_tracking',automation_paused:false}).select('*').single()
      data=created.data
    }
    if(data){
      setConversation(data as Conversation)
      await loadMessages(data.id)
      if(!messages.length){
        const {data:existing}=await supabase.from('support_messages').select('id').eq('conversation_id',data.id).limit(1)
        if(!existing?.length){
          await supabase.from('support_messages').insert({conversation_id:data.id,sender:'bot',body:'Hello! I’m the UPC Support Agent. Please provide your tracking number so I can check your shipment.'})
          await loadMessages(data.id)
        }
      }
    }
  }

  useEffect(()=>{if(open)ensureConversation()},[open])

  useEffect(()=>{
    if(!conversation?.id)return
    const timer=setInterval(async()=>{
      await loadMessages(conversation.id)
      const {data}=await supabase.from('support_conversations').select('*').eq('id',conversation.id).single()
      if(data)setConversation(data as Conversation)
    },1800)
    return()=>clearInterval(timer)
  },[conversation?.id])

  async function send(){
    const value=text.trim();if(!value||!conversation||busy)return
    setBusy(true);setText('')
    await supabase.from('support_messages').insert({conversation_id:conversation.id,sender:'customer',body:value})
    await supabase.from('support_conversations').update({updated_at:new Date().toISOString(),last_customer_message_at:new Date().toISOString()}).eq('id',conversation.id)
    await loadMessages(conversation.id)

    if(conversation.automation_stage==='agent_takeover' || conversation.automation_paused){setBusy(false);return}

    const candidate=value.match(/[A-Z0-9][A-Z0-9-]{5,}/i)?.[0]
    if(!candidate){
      setTyping(true)
      window.setTimeout(async()=>{
        await supabase.from('support_messages').insert({conversation_id:conversation.id,sender:'bot',body:'Please provide your tracking number so I can check the shipment for you.'})
        setTyping(false);await loadMessages(conversation.id);setBusy(false)
      },900)
      return
    }

    await supabase.from('support_conversations').update({tracking_number:candidate.toUpperCase(),automation_stage:'checking',updated_at:new Date().toISOString()}).eq('id',conversation.id)
    setTyping(true)
    window.setTimeout(async()=>{
      await supabase.from('support_messages').insert({conversation_id:conversation.id,sender:'bot',body:'Checking your tracking number……'})
      await supabase.from('support_conversations').update({automation_stage:'agent_takeover',automation_paused:true,updated_at:new Date().toISOString()}).eq('id',conversation.id)
      setTyping(false);await loadMessages(conversation.id);setConversation(c=>c?{...c,automation_stage:'agent_takeover',automation_paused:true}:c);setBusy(false)
    },1800)
  }

  return <>
    <button className="agent-fab" onClick={()=>setOpen(v=>!v)} aria-label="Open UPC Agent">Agent</button>
    {open&&<aside className="agent-chat" aria-label="UPC Support Agent">
      <header><div><strong>UPC Support Agent</strong><small><span/> {conversation?.automation_stage==='agent_takeover'?'Agent ready to help':'Online · Ready to help'}</small></div><button onClick={()=>setOpen(false)} aria-label="Close">×</button></header>
      <div className="agent-body">
        {messages.map(m=><div className={'agent-message '+m.sender} key={m.id}><small>{m.sender==='customer'?'You':m.sender==='agent'?'UPC Agent':'UPC Agent'}</small><div>{m.body}</div></div>)}
        {typing&&<div className="agent-message bot typing"><small>UPC Agent</small><div>Checking<span className="dots">...</span></div></div>}
      </div>
      <form onSubmit={e=>{e.preventDefault();send()}} className="agent-input"><input value={text} onChange={e=>setText(e.target.value)} disabled={busy} placeholder={conversation?.automation_stage==='agent_takeover'?'Agent is reviewing your shipment…':'Enter your tracking number…'}/><button disabled={busy||!text.trim()}>Send</button></form>
    </aside>}
  </>
}
