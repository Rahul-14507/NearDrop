import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getAccessToken(request: NextRequest): Promise<string | undefined> {
  const token = await getToken({ req: request })
  return token?.accessToken as string | undefined
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const upstreamPath = '/' + pathSegments.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  return `${API_URL}${upstreamPath}${searchParams ? '?' + searchParams : ''}`
}

function authHeaders(accessToken: string | undefined): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const accessToken = await getAccessToken(request)
  const url = buildUpstreamUrl(request, params.path)

  const resp = await fetch(url, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  })

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const accessToken = await getAccessToken(request)
  const url = buildUpstreamUrl(request, params.path)

  const contentType = request.headers.get('content-type') ?? ''

  let body: BodyInit
  if (contentType.includes('multipart/form-data')) {
    body = await request.formData()
  } else {
    body = await request.text()
  }

  const headers: Record<string, string> = { ...authHeaders(accessToken) }
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const accessToken = await getAccessToken(request)
  const url = buildUpstreamUrl(request, params.path)

  const contentType = request.headers.get('content-type') ?? ''
  const body = await request.text()

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
  })

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const accessToken = await getAccessToken(request)
  const url = buildUpstreamUrl(request, params.path)

  const resp = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })

  if (resp.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}
