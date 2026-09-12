import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '72px', background: '#f4f2ef', color: '#351c15', fontFamily: 'Arial' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ width: '112px', height: '82px', borderRadius: '14px', background: '#ffca05', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', fontWeight: 900 }}>UPC</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>PACKAGE TRACKER</div>
        </div>
        <div style={{ marginTop: '48px', fontSize: '58px', fontWeight: 800, color: '#351c15' }}>UPC Package Tracker</div>
        <div style={{ marginTop: '18px', fontSize: '28px', color: '#6d625c' }}>Track your delivery with real-time shipment updates.</div>
        <div style={{ marginTop: '42px', display: 'flex', gap: '16px', fontSize: '22px', fontWeight: 700 }}>Fast delivery • Live tracking • Delivery alerts</div>
        <div style={{ marginTop: '34px', fontSize: '20px', color: '#6d625c' }}>upctracker.site</div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
