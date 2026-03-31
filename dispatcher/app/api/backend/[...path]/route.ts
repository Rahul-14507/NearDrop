import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getToken(): string | undefined {
  const store = cookies()
  return store.get('nd_dispatcher_token')?.value
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const upstreamPath = '/' + pathSegments.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  return `${API_URL}${upstreamPath}${searchParams ? '?' + searchParams : ''}`
}

function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const token = getToken()
  const url = buildUpstreamUrl(request, params.path)

  const resp = await fetch(url, {
    headers: authHeaders(token),
    cache: 'no-store',
  })

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const token = getToken()
  const url = buildUpstreamUrl(request, params.path)

  const contentType = request.headers.get('content-type') ?? ''

  let body: BodyInit
  if (contentType.includes('multipart/form-data')) {
    body = await request.formData()
  } else {
    body = await request.text()
  }

  const headers: Record<string, string> = { ...authHeaders(token) }
  // Only forward Content-Type for non-multipart (browser sets boundary automatically for FormData)
  if (!contentType.includes('multipart/form-data') && contentType) {
    headers['Content-Type'] = contentType
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}
