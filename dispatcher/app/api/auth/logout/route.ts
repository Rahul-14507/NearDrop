import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('nd_dispatcher_token')
  response.cookies.delete('nd_dispatcher_token_pub')
  return response
}
