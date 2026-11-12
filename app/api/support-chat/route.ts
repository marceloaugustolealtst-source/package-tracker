import {createHash,randomBytes,timingSafeEqual} from 'node:crypto'
import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const SESSION_COOKIE='upc_support_session'
const MAX_BODY_BYTES=12*1024*1024
const TRACKING_PATTERN=/^[A-Z0-9][A-Z0-9-]{5,31}$/
const BOT_REPLIES:Record<string,string>={
  request_tracking:'Please provide your correct UPC tracking number.',
  invalid_tracking:'Please provide the correct UPC tracking number. I can only check a registered UPC shipment number.',
  checking_tracking:'Checking your tracking number……'
}

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)throw new Error('Support chat server database configuration is missing')
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
}

function validSessionId(value:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function hashToken(token:string){
  return createHash('sha256').update(token).digest('hex')
}

function cookieValue(req:Request,name:string){
  const raw=req.headers.get('cookie')||''
  const item=raw.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))
  if(!item)return ''
  try{return decodeURIComponent(item.slice(name.length+1))}catch{return ''}
}

function tokenMatches(token:string,storedHash:string|null|undefined){
  if(!token||!storedHash)return false
  const actual=Buffer.from(hashToken(token),'hex')
  const expected=Buffer.from(storedHash,'hex')
  return actual.length===expected.length&&timingSafeEqual(actual,expected)
}

function setSessionCookie(response:NextResponse,token:string){
  response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/support-chat',maxAge:60*60*24*180})
  return response
}

function safeConversation(conversation:any){if(!conversation)return null;const {session_token_hash,...safe}=conversation;return safe}

function json(data:any,status=200){
  return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Origin'}})
}

function originIsAllowed(req:Request){
  const origin=req.headers.get('origin')
  if(!origin)return true
  try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}

async function getConversationBySession(supabase:any,sessionId:string){
  const result=await supabase.from('support_conversations').select('id,session_id,session_token_hash,user_last_read_at,status').eq('session_id',sessionId).maybeSingle()
  if(result.error)throw result.error
  return result.data
}

async function bindOrVerifySession(req:Request,supabase:any,conversation:any){
  const existingToken=cookieValue(req,SESSION_COOKIE)
  if(conversation.session_token_hash){
    return tokenMatches(existingToken,conversation.session_token_hash)?{ok:true as const,token:null as string|null}:{ok:false as const,token:null as string|null}
  }
  const token=randomBytes(32).toString('base64url')
  const updated=await supabase.from('support_conversations').update({session_token_hash:hashToken(token)}).eq('id',conversation.id).is('session_token_hash',null).select('id').maybeSingle()
  if(updated.error)throw updated.error
  if(!updated.data)return {ok:false as const,token:null as string|null}
  return {ok:true as const,token}
}

async function automationEnabled(supabase:any){
  const result=await supabase.from('support_settings').select('automated_replies_enabled').eq('id',true).maybeSingle()
  if(result.error)throw result.error
  return result.data?.automated_replies_enabled??true
}

async function getOrCreateConversation(supabase:any,sessionId:string){
  const found=await supabase.from('support_conversations').select('*').eq('session_id',sessionId).maybeSingle()
  if(found.error)throw found.error
  if(found.data){
    if(found.data.status==='closed'){
      const reopened=await supabase.from('support_conversations').update({status:'open',automation_stage:'awaiting_tracking',automation_paused:false,updated_at:new Date().toISOString()}).eq('id',found.data.id).select('*').single()
      if(reopened.error)throw reopened.error
      return reopened.data
    }
    return found.data
  }
  const created=await supabase.from('support_conversations').insert({session_id:sessionId,status:'open',automation_stage:'awaiting_tracking',automation_paused:false,updated_at:new Date().toISOString()}).select('*').single()
  if(created.error)throw created.error
  return created.data
}

async function getOwnedConversation(supabase:any,conversationId:string,sessionId:string){
  if(!conversationId||!sessionId)return null
  const result=await supabase.from('support_conversations').select('*').eq('id',conversationId).eq('session_id',sessionId).maybeSingle()
  if(result.error)throw result.error
  return result.data
}

async function permanentlyDeleteConversation(supabase:any,conversationId:string,sessionId:string){
  const conversation=await getOwnedConversation(supabase,conversationId,sessionId)
  if(!conversation)return false
  const messages=await supabase.from('support_messages').delete().eq('conversation_id',conversationId)
  if(messages.error)throw messages.error
  const deleted=await supabase.from('support_conversations').delete().eq('id',conversationId).eq('session_id',sessionId)
  if(deleted.error)throw deleted.error
  return true
}

export async function POST(req:Request){
  try{
    if(!originIsAllowed(req))return json({error:'Request origin is not allowed'},403)
    const declaredLength=Number(req.headers.get('content-length')||0)
    if(declaredLength>MAX_BODY_BYTES)return json({error:'Request is too large'},413)
    const rawBody=await req.text()
    if(Buffer.byteLength(rawBody,'utf8')>MAX_BODY_BYTES)return json({error:'Request is too large'},413)
    let body:any
    try{body=JSON.parse(rawBody)}catch{return json({error:'Invalid JSON request'},400)}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request'},400)

    const action=String(body.action||'')
    const sessionId=String(body.session_id||'').trim()
    if(!validSessionId(sessionId))return json({error:'A valid support session is required'},400)

    const supabase=adminClient()

    if(action==='ensure'){
      const conversation=await getOrCreateConversation(supabase,sessionId)
      const binding=await bindOrVerifySession(req,supabase,conversation)
      if(!binding.ok)return json({error:'Support session could not be verified. Please start a new support session.'},403)
      const existing=await supabase.from('support_messages').select('id').eq('conversation_id',conversation.id).limit(1)
      if(existing.error)throw existing.error
      if(!existing.data?.length){
        const greeting=await supabase.from('support_messages').insert({conversation_id:conversation.id,sender:'bot',body:'Hello! I’m the UPC Support Agent. If you want to track your package, please send your tracking number.'})
        if(greeting.error)throw greeting.error
      }
      const readUpdate=await supabase.from('support_conversations').update({user_last_read_at:new Date().toISOString()}).eq('id',conversation.id).eq('session_id',sessionId)
      if(readUpdate.error)throw readUpdate.error
      const messages=await supabase.from('support_messages').select('id,sender,body,created_at').eq('conversation_id',conversation.id).order('created_at',{ascending:true})
      if(messages.error)throw messages.error
      const response=json({conversation:safeConversation(conversation),messages:messages.data||[],automated_replies_enabled:await automationEnabled(supabase)})
      return binding.token?setSessionCookie(response,binding.token):response
    }

    if(action==='session'){
      const conversation=await getConversationBySession(supabase,sessionId)
      if(!conversation)return json({unread_count:0})
      const binding=await bindOrVerifySession(req,supabase,conversation)
      if(!binding.ok)return json({error:'Support session could not be verified. Please reopen support chat.'},403)
      const count=await supabase.from('support_messages').select('id',{count:'exact',head:true}).eq('conversation_id',conversation.id).eq('sender','agent').gt('created_at',conversation.user_last_read_at||'1970-01-01T00:00:00.000Z')
      if(count.error)throw count.error
      const response=json({unread_count:Math.min(count.count||0,99)})
      return binding.token?setSessionCookie(response,binding.token):response
    }

    const sessionConversation=await getConversationBySession(supabase,sessionId)
    if(!sessionConversation||!tokenMatches(cookieValue(req,SESSION_COOKIE),sessionConversation.session_token_hash))return json({error:'Support session could not be verified. Please reopen support chat.'},403)

    if(action==='messages'){
      const conversationId=String(body.conversation_id||'').trim()
      if(!conversationId)return json({error:'Missing conversation id'},400)
      const conversation=await getOwnedConversation(supabase,conversationId,sessionId)
      if(!conversation)return json({error:'Conversation does not belong to this session'},403)
      const readUpdate=await supabase.from('support_conversations').update({user_last_read_at:new Date().toISOString()}).eq('id',conversationId).eq('session_id',sessionId)
      if(readUpdate.error)throw readUpdate.error
      const messages=await supabase.from('support_messages').select('id,sender,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true})
      if(messages.error)throw messages.error
      return json({conversation:safeConversation(conversation),messages:messages.data||[],automated_replies_enabled:await automationEnabled(supabase)})
    }

    if(action==='send'||action==='bot'){
      const conversationId=String(body.conversation_id||'').trim()
      const text=String(body.body||'').trim()
      const replyCode=String(body.reply_code||'')
      if(action==='send'&&!text)return json({error:'Message body is required'},400)
      if(action==='send'&&text.length>11*1024*1024)return json({error:'Message is too large'},413)
      if(action==='bot'&&!Object.prototype.hasOwnProperty.call(BOT_REPLIES,replyCode))return json({error:'Invalid automated reply'},400)
      if(action==='bot'&&body.body!==undefined)return json({error:'Automated replies are server controlled'},400)

      const enabled=await automationEnabled(supabase)
      if(action==='bot'&&!enabled)return json({error:'Automated replies are disabled',automated_replies_enabled:false},409)
      let conversation:any=null
      if(conversationId)conversation=await getOwnedConversation(supabase,conversationId,sessionId)
      if(conversationId&&!conversation)return json({error:'Conversation does not belong to this session'},403)
      if(!conversation)conversation=await getOrCreateConversation(supabase,sessionId)
      if(conversation.status==='closed')conversation=await getOrCreateConversation(supabase,sessionId)

      const sender=action==='bot'?'bot':'customer'
      const messageBody=action==='bot'?BOT_REPLIES[replyCode]:text
      if(action==='send'&&messageBody.startsWith('[[image]]')&&!/^\[\[image\]\]data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(messageBody))return json({error:'Invalid image attachment'},400)
      if(action==='send'&&!messageBody.startsWith('[[image]]')&&messageBody.length>4000)return json({error:'Message is too long'},413)

      const inserted=await supabase.from('support_messages').insert({conversation_id:conversation.id,sender,body:messageBody}).select('id,conversation_id,sender,body,created_at').single()
      if(inserted.error)throw inserted.error
      const updated=await supabase.from('support_conversations').update({status:'open',updated_at:new Date().toISOString()}).eq('id',conversation.id).eq('session_id',sessionId)
      if(updated.error)throw updated.error
      return json({conversation_id:conversation.id,message:inserted.data,automated_replies_enabled:enabled})
    }

    if(action==='close'){
      const conversationId=String(body.conversation_id||'').trim()
      if(!conversationId)return json({error:'Missing conversation id'},400)
      const deleted=await permanentlyDeleteConversation(supabase,conversationId,sessionId)
      return json({success:deleted,conversation_id:conversationId,messages_deleted:deleted})
    }

    if(action==='update'){
      const conversationId=String(body.conversation_id||'').trim()
      const patch=body.patch
      if(!conversationId||!patch||typeof patch!=='object'||Array.isArray(patch))return json({error:'Invalid conversation update'},400)
      const conversation=await getOwnedConversation(supabase,conversationId,sessionId)
      if(!conversation)return json({error:'Conversation does not belong to this session'},403)
      const clean:any={}
      if(patch.tracking_number!==undefined){
        const tracking=String(patch.tracking_number).trim().toUpperCase()
        if(!TRACKING_PATTERN.test(tracking))return json({error:'Invalid tracking number'},400)
        clean.tracking_number=tracking
      }
      if(patch.automation_stage!==undefined){
        const stage=String(patch.automation_stage)
        if(!['awaiting_tracking','checking','agent_takeover'].includes(stage))return json({error:'Invalid automation stage'},400)
        clean.automation_stage=stage
      }
      if(patch.automation_paused!==undefined){
        if(typeof patch.automation_paused!=='boolean')return json({error:'Invalid automation setting'},400)
        clean.automation_paused=patch.automation_paused
      }
      if(!Object.keys(clean).length)return json({error:'No valid conversation changes supplied'},400)
      clean.updated_at=new Date().toISOString()
      const updated=await supabase.from('support_conversations').update(clean).eq('id',conversationId).eq('session_id',sessionId).select('*').single()
      if(updated.error)throw updated.error
      return json({conversation:safeConversation(updated.data)})
    }

    if(action==='lookup'){
      const trackingNumber=String(body.tracking_number||'').trim().toUpperCase()
      if(!TRACKING_PATTERN.test(trackingNumber))return json({packages:[]})
      const result=await supabase.rpc('get_tracking_package',{p_tracking_number:trackingNumber})
      if(result.error)throw result.error
      return json({packages:result.data||[]})
    }

    return json({error:'Unknown support chat action'},400)
  }catch(error:any){
    console.error('support-chat request failed',error)
    return json({error:'Support chat request failed. Please try again.'},500)
  }
}
