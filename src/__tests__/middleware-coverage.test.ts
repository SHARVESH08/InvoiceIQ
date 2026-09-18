import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The (business) route group adds no URL segment, so every directory under it
 * resolves at the root (/invoices, /crm, ...). Each one therefore needs an
 * entry in BOTH the middleware's BUSINESS_PREFIXES list and its config.matcher
 * — a route present in the group but missing from either runs no auth guard.
 *
 * This has already regressed twice: /crm and /hq shipped without matcher
 * entries, and /godowns and /notifications did the same. This test fails the
 * build rather than letting the next one through.
 */

const BUSINESS_DIR = resolve(__dirname, '../app/(business)')
const MIDDLEWARE = resolve(__dirname, '../middleware.ts')

function businessRouteSegments(): string[] {
  return readdirSync(BUSINESS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    // Private folders (_components) and route groups ((x)) produce no URL.
    .filter((e) => !e.name.startsWith('_') && !e.name.startsWith('('))
    // Only directories that actually render something at their own path or below.
    .filter((e) => existsSync(resolve(BUSINESS_DIR, e.name)))
    .map((e) => `/${e.name}`)
}

describe('middleware covers every business route', () => {
  const source = readFileSync(MIDDLEWARE, 'utf8')
  const segments = businessRouteSegments()

  it('finds the business route directories', () => {
    expect(segments.length).toBeGreaterThan(5)
    expect(segments).toContain('/invoices')
  })

  it.each(businessRouteSegments())('%s is in BUSINESS_PREFIXES', (segment) => {
    expect(source).toContain(`'${segment}',`)
  })

  it.each(businessRouteSegments())('%s is in config.matcher', (segment) => {
    expect(source).toContain(`'${segment}(.*)'`)
  })
})

describe('auth redirects point at a real route', () => {
  it('never redirects to /login, which is not a route in this app', () => {
    // The login pages live at /auth/business/login and /auth/customer/login.
    const appDir = resolve(__dirname, '../app')
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full)
        } else if (/\.tsx?$/.test(entry.name)) {
          const content = readFileSync(full, 'utf8')
          if (content.includes("redirect('/login')") || content.includes('redirect("/login")')) {
            offenders.push(full)
          }
        }
      }
    }
    walk(appDir)
    walk(resolve(__dirname, '../lib'))

    expect(offenders, `redirect('/login') 404s — use '/auth/business/login'`).toEqual([])
  })
})
