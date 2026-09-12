import './globals.css'
import './realistic-media.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
import '../components/SupportAgent.css'
import Script from 'next/script'
import GlobalLanguage from '@/components/GlobalLanguage'
import SupportAgent from '@/components/SupportAgent'

export const metadata={title:'UPC Package Tracker',description:'Track your UPC shipment quickly and securely with real-time delivery updates.',metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://upc-package-tracker.vercel.app'),icons:{icon:'/icon.svg',shortcut:'/icon.svg',apple:'/icon.svg'},openGraph:{title:'UPC Package Tracker',description:'Track your UPC shipment and follow delivery progress in real time.',type:'website',siteName:'UPC Package Tracker',images:[{url:'/og-image.svg',width:1200,height:630,alt:'UPC Package Tracker'}]},twitter:{card:'summary_large_image',title:'UPC Package Tracker',description:'Track your UPC shipment and follow delivery progress in real time.',images:['/og-image.svg']}}

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><GlobalLanguage/><SupportAgent/><div id="google_translate_element" style={{position:'fixed',width:0,height:0,overflow:'hidden',opacity:0,pointerEvents:'none'}}/><Script id="upc-google-translate" strategy="beforeInteractive">{`window.googleTranslateElementInit=function(){new window.google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false,multilanguagePage:true},'google_translate_element')};(function(){var l=localStorage.getItem('upc-language');if(l&&l!=='en'){document.cookie='googtrans=/en/'+l+';path=/;max-age=31536000'}})();`}</Script><Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive"/>{children}</body></html>}