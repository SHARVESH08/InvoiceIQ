// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { FinalCta } from './final-cta'
import { HowItWorks } from './how-it-works'

describe('landing sections', () => {
  it('FinalCta shows the single signup CTA label', () => {
    render(<FinalCta />)
    const cta = screen.getByRole('link', { name: 'Get started' })
    expect(cta).toBeInTheDocument()
    expect(cta).toHaveAttribute('href', '/get-started')
  })
  it('HowItWorks renders three steps', () => {
    render(<HowItWorks />)
    expect(screen.getByText('Add your GSTIN')).toBeInTheDocument()
    expect(screen.getByText(/Bill & track/i)).toBeInTheDocument()
  })
})
