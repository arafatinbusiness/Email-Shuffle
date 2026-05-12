export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)'],
}
