import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import Sidebar from '@/components/Sidebar'

async function getDispatcherName(): Promise<string> {
  const cookieStore = cookies()
  const token = cookieStore.get('nd_dispatcher_token')?.value
  if (!token) return 'Dispatcher'
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY ?? 'neardrop-dev-secret-change-in-production',
    )
    const { payload } = await jwtVerify(token, secret)
    return (payload['name'] as string | undefined) ?? 'Dispatcher'
  } catch {
    return 'Dispatcher'
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const name = await getDispatcherName()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar dispatcherName={name} />
      <main className="flex-1 overflow-auto bg-navy">
        {children}
      </main>
    </div>
  )
}
