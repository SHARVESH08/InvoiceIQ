// @vitest-environment jsdom
import { render } from '@testing-library/react'
import '../../../tests/setup-dom'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('merges custom classes onto the pulse base', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('h-8')
  })
})
