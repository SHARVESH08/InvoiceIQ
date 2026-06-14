import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { TrustMarquee } from '@/components/landing/trust-marquee'
import { FeatureAI } from '@/components/landing/feature-ai'
import { FeatureWhatsApp } from '@/components/landing/feature-whatsapp'
import { FeaturePricing } from '@/components/landing/feature-pricing'
import { CapabilitiesOrbit } from '@/components/landing/capabilities-orbit'
import { WhyDifferent } from '@/components/landing/why-different'
import { HowItWorks } from '@/components/landing/how-it-works'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export const metadata = {
  title: 'InvoiceIQ: Billing that thinks for Indian business',
  description:
    'GST invoicing, live inventory, WhatsApp orders, and AI pricing alerts. One system for Indian SMBs.',
}

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
        <CapabilitiesOrbit />
        <WhyDifferent />
        <HowItWorks />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
