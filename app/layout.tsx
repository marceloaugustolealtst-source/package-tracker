import './globals.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
import Script from 'next/script'
import GlobalLanguage from '@/components/GlobalLanguage'
export const metadata={title:'UPC Package Tracker',description:'UPC shipment tracking and logistics portal'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><GlobalLanguage/><div id="google_translate_element" style={{display:'none'}}/><Script id="google-translate-init" strategy="afterInteractive">{`window.googleTranslateElementInit=function(){new window.google.translate.TranslateElement({pageLanguage:'en',autoDisplay:false},'google_translate_element')}`}</Script><Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive"/>{children}</body></html>}