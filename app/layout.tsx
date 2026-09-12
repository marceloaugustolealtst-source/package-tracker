import './globals.css'
import './admin/admin.module.css'
import './admin/receipt.module.css'
export const metadata={title:'UPC Package Tracker',description:'UPC shipment tracking and logistics portal'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}