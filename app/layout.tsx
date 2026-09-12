import './globals.css'
import './realistic-media.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
import Script from 'next/script'
import GlobalLanguage from '@/components/GlobalLanguage'

export const metadata={
  title:'UPC Package Tracker',
  description:'Track your UPC shipment quickly and securely with real-time delivery updates.',
  metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://upc-package-tracker.vercel.app'),
  icons:{icon:'/icon.svg',shortcut:'/icon.svg',apple:'/icon.svg'},
  openGraph:{
    title:'UPC Package Tracker',
    description:'Track your UPC shipment and follow delivery progress in real time.',
    type:'website',
    siteName:'UPC Package Tracker',
    images:[{url:'/og-image.svg',width:1200,height:630,alt:'UPC Package Tracker'}]
  },
  twitter:{card:'summary_large_image',title:'UPC Package Tracker',description:'Track your UPC shipment and follow delivery progress in real time.',images:['/og-image.svg']}
}

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><GlobalLanguage/><div id="google_translate_element" style={{display:'none'}}/><Script id="upc-language-persistence" strategy="afterInteractive">{`document.addEventListener('change',function(e){var t=e.target;if(t&&t.tagName==='SELECT'&&t.getAttribute('aria-label')==='Language'){var v=t.value;try{localStorage.setItem('upc-language',v)}catch(_){};document.cookie=v==='en'?'googtrans=;path=/;max-age=0':'googtrans=/en/'+v+';path=/';}});window.googleTranslateElementInit=function(){new (window).google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false},'google_translate_element')}`}</Script><Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive"/>{children}</body></html>}