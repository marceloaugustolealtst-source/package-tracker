import './globals.css'
import './realistic-media.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
import '../components/SupportAgent.css'
import '../components/language-fix.css'
import Script from 'next/script'
import SupportAgent from '@/components/SupportAgent'
import AppSplash from '@/components/AppSplash'

export const metadata={title:'UPC Package Tracker',description:'Track your UPC shipment quickly and securely with real-time delivery updates.',metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://upctracker.site'),icons:{icon:'/icon.svg',shortcut:'/icon.svg',apple:'/icon.svg'},openGraph:{title:'UPC Package Tracker',description:'Track your UPC shipment and follow delivery progress in real time.',type:'website',siteName:'UPC Package Tracker',images:[{url:'/whatsapp-preview.svg',width:1200,height:630,alt:'UPC Package Tracker'}]},twitter:{card:'summary_large_image',title:'UPC Package Tracker',description:'Track your UPC shipment and follow delivery updates in real time.',images:['/whatsapp-preview.svg']}}

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AppSplash/><SupportAgent/><div id="google_translate_element" style={{position:'fixed',width:0,height:0,overflow:'hidden',opacity:0,pointerEvents:'none'}}/><Script id="upc-google-translate" strategy="beforeInteractive">{`window.googleTranslateElementInit=function(){new window.google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false,multilanguagePage:true,includedLanguages:'en,es,fr,de,pt,ar,zh-CN,ja,ko,hi,sw,yo,ig,ha,am,ru,uk,pl,vi,id,th,tr,it,nl,sv,da,no,fi'},'google_translate_element')};(function(){var l=localStorage.getItem('upc-language');if(l&&l!=='en'){var target=l==='zh'?'zh-CN':l;document.cookie='googtrans=/en/'+target+';path=/;max-age=31536000'}document.addEventListener('change',function(e){var t=e.target;if(t&&t.tagName==='SELECT'&&t.getAttribute('aria-label')==='Language'){var v=t.value;try{localStorage.setItem('upc-language',v)}catch(_){}var target=v==='zh'?'zh-CN':v;document.cookie=target==='en'?'googtrans=;path=/;max-age=0':'googtrans=/en/'+target+';path=/;max-age=31536000';setTimeout(function(){location.reload()},50)}})})();`}</Script><Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive"/>{children}</body></html>}
