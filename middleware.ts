import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Define public routes that don't require authentication
  const isPublicRoute =
    nextUrl.pathname.startsWith('/login') ||
    nextUrl.pathname.startsWith('/signup') ||
    nextUrl.pathname.startsWith('/api/auth') ||
    nextUrl.pathname.startsWith('/api/campaigns/process-scheduled') ||
    nextUrl.pathname.startsWith('/api/contacts/check') ||
    nextUrl.pathname.startsWith('/_next/static') ||
    nextUrl.pathname.startsWith('/_next/image') ||
    nextUrl.pathname === '/favicon.ico' ||
    nextUrl.pathname.match(/\.(png|svg|jpg)$/) !== null

  // Redirect to login if not authenticated and not on a public route
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  // Redirect to home if authenticated and on login/signup
  if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)'],
}
