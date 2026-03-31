import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json() as { email: string; password: string }
  const { email, password } = body

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

  let apiResp: Response
  try {
    apiResp = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: 'dispatcher' }),
    })
  } catch {
    return NextResponse.json({ error: 'Cannot reach API server' }, { status: 502 })
  }

  if (!apiResp.ok) {
    const err = await apiResp.json().catch(() => ({ detail: 'Login failed' })) as { detail: string }
    return NextResponse.json({ error: err.detail }, { status: apiResp.status })
  }

  const data = await apiResp.json() as {
    access_token: string
    name: string
    user_id: number
    role: string
  }

  const response = NextResponse.json({ success: true, name: data.name })

  // httpOnly cookie — used by middleware to protect /dashboard routes
  response.cookies.set('nd_dispatcher_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,   // 30 days
    path: '/',
  })

  // Non-httpOnly cookie — readable by the proxy route handler to attach auth header
  response.cookies.set('nd_dispatcher_token_pub', data.access_token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
