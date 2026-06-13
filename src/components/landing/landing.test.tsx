// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { FinalCta } from './final-cta'
import { HowItWorks } from './how-it-works'

describe('landing sections', () => {
  it('FinalCta shows the single signup CTA label', () => {
    render(<FinalCta />)
    expect(screen.getByRole('link', { name: 'Start free' })).toBeInTheDocument()
  })
  it('HowItWorks renders three steps', () => {
    render(<HowItWorks />)
    expect(screen.getByText('Add your GSTIN')).toBeInTheDocument()
    expect(screen.getByText(/Bill & track/i)).toBeInTheDocument()
  })
})
