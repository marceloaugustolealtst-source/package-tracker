'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const modes = [
  ['🚚', 'Road', 'Fast door-to-door delivery across cities and regions.'],
  ['✈️', 'Air', 'Priority international shipping for time-sensitive packages.'],
  ['🚢', 'Ocean', 'Reliable global freight for larger and long-distance shipments.'],
  ['🚆', 'Rail', 'Efficient long-distance transport connecting major trade routes.'],
]

export default function Home() {
  const [tracking, setTracking] = useState('')
  const router = useRouter()
  return <main className="ups-home">
    <header className="brandbar"><div className="brandmark">UPC</div><nav>
      <a href="#tracking">Tracking</a><a href="#services">Services</a><a href="#why">Why UPC</a><a href="#support">Support</a>
      <a className="nav-login" href="/login">Sign in</a><a className="nav-register" href="/register">Create account</a>
    </nav></header>

    <section className="hero" id="tracking"><div className="hero-copy">
      <div className="eyebrow">UPC PACKAGE DELIVERY</div><h1>Delivering what matters, wherever it needs to go.</h1>
      <p>Move packages quickly and confidently with real-time tracking, flexible delivery services and dependable global transportation.</p>
      <form onSubmit={e => { e.preventDefault(); if (tracking.trim()) router.push(`/track/${tracking.trim().toUpperCase()}`) }}>
        <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Enter tracking number or reference" aria-label="Tracking number" />
        <button className="track-btn">TRACK</button>
      </form><div className="quick">Track as a guest — no account required.</div>
    </div><div className="hero-image"><div className="courier-scene"><div className="package">UPC</div><div className="courier">◉</div><div className="receiver">◉</div><div className="scene-label">FROM OUR DOOR TO YOURS</div></div></div></section>

    <section className="intro"><div><div className="eyebrow">MOVE WITH CONFIDENCE</div><h2>Shipping made simple.</h2></div><p>From everyday parcels to international freight, UPC gives you visibility from pickup to delivery.</p></section>

    <section id="services" className="modes"><div className="section-heading"><div className="eyebrow">DELIVERY NETWORK</div><h2>Four ways to move your shipment</h2></div><div className="mode-grid">{modes.map(([icon,title,text]) => <article className="mode-card" key={title}><div className="mode-icon">{icon}</div><h3>{title}</h3><p>{text}</p><a href="#tracking">Track a shipment →</a></article>)}</div></section>

    <section id="why" className="why"><div className="why-copy"><div className="eyebrow">WHY CHOOSE UPC</div><h2>Built around speed, visibility and service.</h2><p>We make every shipment easier to manage with clear tracking information and dependable delivery options.</p></div><div className="why-grid"><article><b>01</b><h3>Fast delivery</h3><p>Choose transportation that fits your deadline.</p></article><article><b>02</b><h3>Live visibility</h3><p>Follow your package through every important step.</p></article><article><b>03</b><h3>Global reach</h3><p>Connect destinations through road, air, ocean and rail.</p></article><article><b>04</b><h3>Helpful support</h3><p>Get straightforward shipment information when you need it.</p></article></div></section>

    <section className="feature-grid"><article><span className="feature-icon">01</span><h2>Track every step</h2><p>See status, location, shipment events and estimated delivery in one place.</p></article><article><span className="feature-icon">02</span><h2>Stay informed</h2><p>Customers with an account can keep their tracking details in one secure place.</p></article><article><span className="feature-icon">03</span><h2>Delivery support</h2><p>Get clear tracking information and help when a shipment needs attention.</p></article></section>

    <section className="account-band"><div><div className="eyebrow">YOUR UPC ACCOUNT</div><h2>Track as a guest or create an account for a more convenient experience.</h2><p>Sign in to manage your customer experience. Tracking remains available without an account.</p></div><div className="account-actions"><a className="btn btn-dark" href="/login">Sign in</a><a className="btn btn-yellow" href="/register">Create account</a></div></section>
    <footer id="support"><strong>UPC</strong><span>Package tracking · Delivery services · Shipment support</span></footer>
  </main>
}
