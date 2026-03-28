import { useState, useCallback, useEffect } from 'react'
import { TrustBadge } from '../../components/ui/Badge'
import { ToastContainer, useToasts } from '../../components/ui/Toast'
import MicButton from './MicButton'
import DeliveryCard from './DeliveryCard'
import HubBroadcastCard from './HubBroadcastCard'
import { failDelivery, getDriverScore, getActiveDelivery } from '../../api'
import { LayoutDashboard, ArrowLeft, Navigation, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

const DRIVER_ID = 1
const DRIVER_LAT = 17.4239
const DRIVER_LNG = 78.4738

export default function DriverApp() {
  const [driver, setDriver]         = useState(null)
  const [delivery, setDelivery]     = useState(null)
  const [hubs, setHubs]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const { toasts, addToast, removeToast } = useToasts()

  const fetchData = useCallback(async () => {
    try {
      const [dResult, adResult] = await Promise.all([
        getDriverScore(DRIVER_ID),
        getActiveDelivery(DRIVER_ID),
      ])
      setDriver({
        id: DRIVER_ID,
        name: dResult.data.name,
        trust_score: dResult.data.trust_score,
        vehicle: 'Royal Enfield',
      })
      setDelivery(adResult.data)
    } catch (err) {
      addToast('Failed to load delivery', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleVoiceCommand = useCallback((transcript) => {
    if (!delivery) return
    const t = transcript.toLowerCase()
    if (t.includes('fail') || t.includes('unable'))         handleStatusChange('failed')
    else if (t.includes('deliver') || t.includes('done'))   handleStatusChange('delivered')
    else if (t.includes('arriv') || t.includes('reached'))  handleStatusChange('arrived')
    else addToast(`"${transcript}" — not recognized`, 'info')
  }, [delivery])

  const handleStatusChange = useCallback(async (newStatus) => {
    if (!delivery || delivery.status === 'delivered' || delivery.status === 'failed') return
    setDelivery(prev => ({ ...prev, status: newStatus }))

    if (newStatus === 'failed') {
      setBroadcastLoading(true)
      addToast('Broadcasting to nearby hubs...', 'info')
      try {
        const res = await failDelivery(delivery.id, DRIVER_LAT, DRIVER_LNG)
        setHubs(res.data.nearby_hubs)
        setShowBroadcast(true)
        if (!res.data.nearby_hubs?.length) addToast('No hubs available nearby', 'error')
      } catch {
        addToast('Broadcast failed', 'error')
      } finally {
        setBroadcastLoading(false)
      }
    } else if (newStatus === 'delivered') {
      addToast('Delivery complete! 🎉', 'success')
    } else if (newStatus === 'arrived') {
      addToast('Arrival confirmed', 'success')
    }
  }, [delivery, addToast])

  const isFinal = delivery?.status === 'delivered' || delivery?.status === 'failed'

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#060c18' }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3"
            style={{
              border: '2px solid rgba(0,201,177,0.2)',
              borderTopColor: '#00c9b1',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading delivery…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh" style={{ background: 'linear-gradient(160deg, #080f1e 0%, #060c18 50%, #04080f 100%)' }}>
      {/* Ambient top glow */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 300,
          background: 'radial-gradient(ellipse at 50% -20%, rgba(0,201,177,0.08) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Content container — mobile centered */}
      <div className="relative z-10 max-w-sm mx-auto min-h-dvh flex flex-col">

        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {/* Back to dash */}
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <LayoutDashboard className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </Link>

            <div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#00c9b1', boxShadow: '0 0 8px rgba(0,201,177,0.8)' }}
                />
                <span className="text-xs font-bold" style={{ color: 'rgba(0,201,177,0.8)', letterSpacing: '0.05em' }}>
                  DRIVER PWA
                </span>
              </div>
              <p className="font-black text-white leading-none mt-0.5" style={{ fontSize: 16 }}>
                {driver?.name ?? '—'}
              </p>
            </div>
          </div>

          <TrustBadge score={driver?.trust_score ?? 0} />
        </header>

        {/* Delivery card */}
        <div className="px-5">
          {delivery
            ? <DeliveryCard delivery={delivery} onStatusChange={handleStatusChange} />
            : (
              <div
                className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Navigation className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No active delivery</p>
                <button onClick={fetchData} className="mt-4 text-sm font-bold" style={{ color: '#00c9b1' }}>Refresh</button>
              </div>
            )
          }
        </div>

        {/* Voice section — only when delivery is active */}
        {delivery && !isFinal && (
          <div className="px-5 mt-4">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-3.5 h-3.5" style={{ color: '#00c9b1' }} />
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Voice Control
                </p>
              </div>
              <MicButton onCommand={handleVoiceCommand} />

              <form
                className="mt-4 flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  const val = e.target.command.value.trim()
                  if (val) { handleVoiceCommand(val); e.target.reset() }
                }}
              >
                <input
                  id="text-command"
                  name="command"
                  className="input flex-1 text-sm"
                  placeholder='Try "arrived", "delivered", "failed"…'
                />
                <button type="submit" className="btn-primary px-4">→</button>
              </form>
            </div>
          </div>
        )}

        {/* Hub broadcast section */}
        {broadcastLoading && (
          <div className="px-5 mt-4">
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3"
              style={{ background: 'rgba(0,201,177,0.06)', border: '1px solid rgba(0,201,177,0.15)' }}
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{
                  border: '2px solid rgba(0,201,177,0.3)',
                  borderTopColor: '#00c9b1',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <p className="text-sm font-semibold" style={{ color: '#00c9b1' }}>Finding nearby hubs…</p>
            </div>
          </div>
        )}

        {showBroadcast && hubs && !broadcastLoading && (
          <div className="px-5 mt-4 pb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white">Nearby Hubs ({hubs.length})</h2>
              </div>
              <button
                onClick={() => setShowBroadcast(false)}
                className="text-xs font-semibold"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Dismiss
              </button>
            </div>
            <HubBroadcastCard
              deliveryId={delivery.id}
              hubs={hubs}
              onAccepted={() => addToast('Hub confirmed! Hand over package to staff.', 'success')}
            />
          </div>
        )}

        {/* Bottom spacer */}
        <div className="flex-1 min-h-[2rem]" />
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
