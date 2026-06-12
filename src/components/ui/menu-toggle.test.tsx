// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import '../../../tests/setup-dom'
import { MenuToggle } from './menu-toggle'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <MenuToggle open={open} onOpenChange={setOpen} />
      <span>{open ? 'OPEN' : 'CLOSED'}</span>
    </>
  )
}

describe('MenuToggle', () => {
  it('calls onOpenChange with the toggled value', async () => {
    render(<Harness />)
    expect(screen.getByText('CLOSED')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('OPEN')).toBeInTheDocument()
  })
})
