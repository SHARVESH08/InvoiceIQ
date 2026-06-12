// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import '../../../tests/setup-dom'
import { SwitchAnimated } from './switch-animated'

function Harness() {
  const [on, setOn] = useState(false)
  return <SwitchAnimated checked={on} onCheckedChange={setOn} aria-label="alerts" />
}

describe('SwitchAnimated', () => {
  it('exposes an accessible checkbox', () => {
    render(<SwitchAnimated checked={false} onCheckedChange={() => {}} aria-label="alerts" />)
    expect(screen.getByRole('checkbox', { name: 'alerts' })).toBeInTheDocument()
  })

  it('toggles checked state on click', async () => {
    render(<Harness />)
    const box = screen.getByRole('checkbox', { name: 'alerts' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(box).toBeChecked()
  })
})
