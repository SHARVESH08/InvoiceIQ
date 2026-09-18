import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // D-15: getUser() — network-validates the access token. NEVER use getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Business app routes live in the (business) route group. A route group adds NO
  // URL segment, so these all resolve at root (e.g. /invoices), NOT under /dashboard.
  // They must ALL be guarded — not just /dashboard (AUTH-08; fixes the matcher gap
  // found in the v1.0 integration audit, where /invoices /products etc. ran no guard).
  // Keep this list in sync with the directories under src/app/(business)/ and
  // with `config.matcher` below. A route added to the group but missed here
  // runs no auth guard at all.
  const BUSINESS_PREFIXES = [
    '/dashboard',
    '/invoices',
    '/products',
    '/customers',
    '/suppliers',
    '/inventory',
    '/settings',
    '/crm',
    '/hq',
    '/godowns',
    '/notifications',
  ]
  const isBusinessPath = BUSINESS_PREFIXES.some((p) => pathname.startsWith(p))

  // D-16: protect business routes — redirect unauthenticated to business login
  if (!user && (isBusinessPath || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/auth/business/login', request.url))
  }
  // D-16: protect /my (customer) — redirect unauthenticated to customer login
  if (!user && pathname.startsWith('/my')) {
    return NextResponse.redirect(new URL('/auth/customer/login', request.url))
  }

  // Wrong user_type routing.
  // user_type appears in app_metadata after the custom access token hook runs (plan 02-02).
  // Fallback: user_metadata.user_type set at signUp (plans 02-04, 02-05).
  if (user) {
    const appMetaType = (user.app_metadata as Record<string, unknown> | undefined)?.user_type
    const userMetaType = (user.user_metadata as Record<string, unknown> | undefined)?.user_type
    const userType = (appMetaType ?? userMetaType) as 'business' | 'customer' | undefined

    if ((isBusinessPath || pathname.startsWith('/onboarding')) && userType === 'customer') {
      return NextResponse.redirect(new URL('/my', request.url))
    }
    if (pathname.startsWith('/my') && userType === 'business') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // D-09: Onboarding guard — redirect business users to /onboarding if not complete
  // Applies to ALL business routes (not /my, not /onboarding itself)
  if (user && isBusinessPath) {
    const appMetaType2 = (user.app_metadata as Record<string, unknown> | undefined)?.user_type
    const userMetaType2 = (user.user_metadata as Record<string, unknown> | undefined)?.user_type
    const userType2 = (appMetaType2 ?? userMetaType2) as string | undefined

    if (userType2 !== 'customer') {
      // Resolve company_id via company_users (avoids RPC call overhead in middleware)
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (companyUser?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('onboarding_step, onboarding_completed')
          .eq('id', companyUser.company_id)
          .single()

        if (company && !company.onboarding_completed) {
          const step = company.onboarding_step ?? 0
          // Redirect is acceptable here (not supabaseResponse) because browser will make
          // a fresh request to /onboarding which goes through middleware again (AUTH-08 intent).
          return NextResponse.redirect(
            new URL(`/onboarding?step=${step + 1}`, request.url)
          )
        }
      }
    }
  }

  // CRITICAL (AUTH-08): always return supabaseResponse — NEVER NextResponse.next() here.
  // Returning a fresh NextResponse drops the refreshed cookies set by setAll above.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard(.*)',
    '/invoices(.*)',
    '/products(.*)',
    '/customers(.*)',
    '/suppliers(.*)',
    '/inventory(.*)',
    '/settings(.*)',
    '/crm(.*)',
    '/hq(.*)',
    '/godowns(.*)',
    '/notifications(.*)',
    '/onboarding(.*)',
    '/my(.*)',
  ],
}
