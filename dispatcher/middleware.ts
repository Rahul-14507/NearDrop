import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('nd_dispatcher_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secretKey = process.env.JWT_SECRET_KEY ?? 'neardrop-dev-secret-change-in-production'
    const secret = new TextEncoder().encode(secretKey)
    const { payload } = await jwtVerify(token, secret)

    if (payload['role'] !== 'dispatcher') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
