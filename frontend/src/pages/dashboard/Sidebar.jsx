import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Truck, Store, Activity, Settings } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Operations', sub: 'Fleet & Analytics' },
  { to: '/driver',    icon: Truck,            label: 'Driver View', sub: 'Mobile Interface' },
  { to: '/hub',       icon: Store,            label: 'Hub Owner',   sub: 'Store Dashboard'  },
]

export default function Sidebar() {
  return (
    <aside
      className="w-60 flex flex-col h-screen sticky top-0 shrink-0"
      style={{
        background: 'linear-gradient(180deg, #0a1020 0%, #060c18 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo area */}
      <div className="px-5 py-7">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[#060c18] text-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg, #00c9b1 0%, #0099a0 100%)',
              boxShadow: '0 4px 16px rgba(0,201,177,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            N
          </div>
          <div>
            <p className="font-black text-white leading-none tracking-tight" style={{ fontSize: 15 }}>
              NearDrop
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(0,201,177,0.7)', letterSpacing: '0.08em' }}>
              LAST MILE OPS
            </p>
          </div>
        </Link>
      </div>

      {/* Status indicator */}
      <div className="mx-4 mb-5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(0,201,177,0.06)', border: '1px solid rgba(0,201,177,0.12)' }}>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-5 h-5">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-teal-400 opacity-75 animate-ping" style={{ animationDuration: '2s' }} />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80">System Live</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Hyderabad · 5 drivers</p>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <p className="px-5 mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Interfaces
      </p>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, sub }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group',
                isActive
                  ? 'bg-[rgba(0,201,177,0.1)] border border-[rgba(0,201,177,0.2)]'
                  : 'border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: isActive ? 'rgba(0,201,177,0.15)' : 'rgba(255,255,255,0.05)',
                    boxShadow: isActive ? '0 2px 12px rgba(0,201,177,0.2)' : 'none',
                  }}
                >
                  <Icon
                    className="w-4 h-4 transition-colors"
                    style={{ color: isActive ? '#00c9b1' : 'rgba(255,255,255,0.4)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold leading-none"
                    style={{ color: isActive ? '#00c9b1' : 'rgba(255,255,255,0.7)' }}
                  >
                    {label}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {sub}
                  </p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Footer user */}
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={{
              background: 'linear-gradient(135deg, #00c9b1 0%, #60a5fa 100%)',
              color: '#060c18',
            }}
          >
            OP
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white/80 leading-none">Operator</p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>admin@neardrop.in</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
