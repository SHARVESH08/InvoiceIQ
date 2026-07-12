import { Reveal } from '@/components/motion/reveal'
import { Sparkles } from 'lucide-react'

export function FeatureAI() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <Reveal>
        <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> What sets us apart
        </p>
      </Reveal>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Ask your books anything.
            </h2>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-muted-foreground">
              An AI assistant that answers in plain language, and a GST filing helper that prepares
              your returns. &ldquo;What is my GST liability this quarter?&rdquo; Answered.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-3 text-sm">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                What is my GST liability this quarter?
              </div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-foreground">
                Output GST ₹84,200, input credit ₹31,750. Net payable
                <span className="font-mono font-semibold text-primary"> ₹52,450</span>. GSTR-3B is
                drafted and ready to review.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
