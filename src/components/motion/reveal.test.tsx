// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { Reveal } from './reveal'

describe('Reveal', () => {
  it('renders its children', () => {
    render(<Reveal><p>Revealed content</p></Reveal>)
    expect(screen.getByText('Revealed content')).toBeInTheDocument()
  })
})
