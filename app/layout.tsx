import './globals.css'
import './realistic-media.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
import Script from 'next/script'
import GlobalLanguage from '@/components/GlobalLanguage'
export const metadata={title:'UPC Package Tracker',description:'UPC shipment tracking and logistics portal'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><GlobalLanguage/><div id="google_translate_element" style={{display:'none'}}/><Script id="upc-language-persistence" strategy="afterInteractive">{`document.addEventListener('change',function(e){var t=e.target;if(t&&t.tagName==='SELECT'&&t.getAttribute('aria-label')==='Language'){var v=t.value;try{localStorage.setItem('upc-language',v)}catch(_){};document.cookie=v==='en'?'googtrans=;path=/;max-age=0':'googtrans=/en/'+v+';path=/';}});window.googleTranslateElementInit=function(){new (window).google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false},'google_translate_element')}`}</Script><Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive"/>{children}</body></html>}