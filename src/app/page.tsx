import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { TrustMarquee } from '@/components/landing/trust-marquee'
import { FeatureAI } from '@/components/landing/feature-ai'
import { FeatureWhatsApp } from '@/components/landing/feature-whatsapp'
import { FeaturePricing } from '@/components/landing/feature-pricing'

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
      </main>
    </div>
  )
}
