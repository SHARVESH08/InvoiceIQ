const STEPS = [
  { number: 1, label: 'Verify GSTIN' },
  { number: 2, label: 'Company Setup' },
  { number: 3, label: 'Add Product' },
  { number: 4, label: 'Create Invoice' },
]

interface OnboardingProgressProps {
  currentStep: number
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-between mb-8" id="onboarding-progress">
      {STEPS.map((s, index) => {
        const isComplete = s.number < currentStep
        const isActive = s.number === currentStep

        const circleClass = isComplete
          ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold'
          : isActive
            ? 'border-2 border-primary text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold'
            : 'border-2 border-border text-muted-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold'

        return (
          <div key={s.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={circleClass}>{s.number}</div>
              <span className="text-xs text-muted-foreground mt-1 text-center">{s.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className="h-px bg-border flex-1 mx-2 mt-[-16px]" />
            )}
          </div>
        )
      })}
    </div>
  )
}
