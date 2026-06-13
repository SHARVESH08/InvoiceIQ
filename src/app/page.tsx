import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { TrustMarquee } from '@/components/landing/trust-marquee'
import { FeatureAI } from '@/components/landing/feature-ai'
import { FeatureWhatsApp } from '@/components/landing/feature-whatsapp'
import { FeaturePricing } from '@/components/landing/feature-pricing'
import { CapabilitiesBento } from '@/components/landing/capabilities-bento'
import { WhyDifferent } from '@/components/landing/why-different'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustMarquee />
        <FeatureAI />
        <FeatureWhatsApp />
        <FeaturePricing />
        <CapabilitiesBento />
        <WhyDifferent />
      </main>
    </div>
  )
}
