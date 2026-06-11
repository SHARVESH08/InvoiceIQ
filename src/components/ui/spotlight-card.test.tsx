// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { GlowCard } from './spotlight-card'

describe('GlowCard', () => {
  it('renders children', () => {
    render(<GlowCard><span>Inside</span></GlowCard>)
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('applies the size class when not customSize', () => {
    const { container } = render(<GlowCard size="lg">x</GlowCard>)
    const card = container.querySelector('[data-glow]') as HTMLElement
    expect(card.className).toContain('w-80')
  })
})
