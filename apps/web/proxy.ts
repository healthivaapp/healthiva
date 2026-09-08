import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // For protected clinic portals, strictly prevent browser disk and memory caching
  // This guarantees that clicking the browser Back button will not serve stale cached dashboard pages
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/doctor') ||
    pathname.startsWith('/pharmacy')
  ) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export default proxy;

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/doctor/:path*',
    '/pharmacy/:path*',
  ],
};
