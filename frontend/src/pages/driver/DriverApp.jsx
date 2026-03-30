import { useState, useCallback, useEffect } from 'react'
import { TrustBadge } from '../../components/ui/Badge'
import { ToastContainer, useToasts } from '../../components/ui/Toast'
import MicButton from './MicButton'
import DeliveryCard from './DeliveryCard'
import HubBroadcastCard from './HubBroadcastCard'
import { failDelivery, getDriverScore, getActiveDelivery } from '../../api'
import { LayoutDashboard, Navigation, Zap } from 'lucide-react'
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
    const fallbackDelivery = {
      id: 999,
      order_id: 'ND10008',
      address: 'Shop 7, Jubilee Hills Check Post, Hyderabad - 500033',
      status: 'en_route',
      recipient_name: 'Anita Singh',
      package_size: 'medium',
      weight_kg: 8.9,
    }

    const [dResult, adResult] = await Promise.allSettled([
      getDriverScore(DRIVER_ID),
      getActiveDelivery(DRIVER_ID),
    ])

    if (dResult.status === 'fulfilled') {
      setDriver({
        id: DRIVER_ID,
        name: dResult.value.data.name,
        trust_score: dResult.value.data.trust_score,
        vehicle: 'Royal Enfield',
      })
    } else {
      setDriver({ id: DRIVER_ID, name: 'Arjun Reddy', trust_score: 0, vehicle: 'Royal Enfield' })
    }

    if (adResult.status === 'fulfilled') {
      setDelivery(adResult.value.data || fallbackDelivery)
    } else {
      addToast('Failed to load delivery', 'error')
      setDelivery(fallbackDelivery)
    }

    setLoading(false)
  }, [addToast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusChange = useCallback(async (newStatus) => {
    if (!delivery || delivery.status === 'delivered' || delivery.status === 'failed') return
    setDelivery(prev => ({ ...prev, status: newStatus }))

    if (newStatus === 'failed') {
      setBroadcastLoading(true)
      addToast('Broadcasting to nearby hubs…', 'info')
      try {
        const res = await failDelivery(delivery.id, DRIVER_LAT, DRIVER_LNG)
        setHubs(res.data.nearby_hubs)
        setShowBroadcast(true)
        if (!res.data.nearby_hubs?.length) addToast('No hubs nearby', 'error')
      } catch { addToast('Broadcast failed', 'error') }
      finally { setBroadcastLoading(false) }
    } else if (newStatus === 'delivered') {
      addToast('Delivery complete! 🎉', 'success')
    } else if (newStatus === 'arrived') {
      addToast('Arrival confirmed', 'success')
    }
  }, [delivery, addToast])

  const handleVoiceCommand = useCallback((t) => {
    if (!delivery) return
    const txt = t.toLowerCase()
    if (txt.includes('fail') || txt.includes('unable'))        handleStatusChange('failed')
    else if (txt.includes('deliver') || txt.includes('done'))  handleStatusChange('delivered')
    else if (txt.includes('arriv') || txt.includes('reached')) handleStatusChange('arrived')
    else addToast(`"${t}" — not recognized`, 'info')
  }, [delivery, handleStatusChange])

  const isFinal = delivery?.status === 'delivered' || delivery?.status === 'failed'

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f5f4f1' }}>
        <div className="bg-mesh" />
        <div className="text-center z-10">
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3"
            style={{
              border: '2px solid rgba(13,115,119,0.18)',
              borderTopColor: '#0d7377',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <p className="text-xs" style={{ color: '#9898a8' }}>Loading delivery…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="min-h-dvh" style={{ background: '#f5f4f1' }}>
      <div className="bg-mesh" />

      <div className="relative z-10 max-w-sm mx-auto min-h-dvh flex flex-col">

        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(0,0,0,0.08)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <LayoutDashboard className="w-4 h-4" style={{ color: '#6b6b7b' }} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: '#0d7377' }}
                />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#0d7377' }}>
                  Driver PWA
                </span>
              </div>
              <p className="font-black leading-none" style={{ fontSize: 16, color: '#111117' }}>
                {driver?.name ?? '—'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9898a8' }}>{driver?.vehicle}</p>
            </div>
          </div>
          <TrustBadge score={driver?.trust_score ?? 0} />
        </header>

        {/* Delivery card */}
        <div className="px-5">
          {delivery ? (
            <DeliveryCard delivery={delivery} onStatusChange={handleStatusChange} />
          ) : (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
              style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1.5px dashed rgba(0,0,0,0.1)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Navigation className="w-10 h-10 mb-3" style={{ color: '#d1d5db' }} />
              <p className="text-sm font-semibold" style={{ color: '#6b6b7b' }}>No active delivery</p>
              <button onClick={fetchData} className="mt-4 text-sm font-bold" style={{ color: '#0d7377' }}>
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Voice section */}
        {delivery && !isFinal && (
          <div className="px-5 mt-6">

            <div
              className="rounded-2xl py-10 px-6"

              style={{
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(255,255,255,0.9)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 2px 24px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Zap className="w-3.5 h-3.5" style={{ color: '#0d7377' }} />
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9898a8' }}>
                  Voice Control
                </p>
              </div>
              <MicButton onCommand={handleVoiceCommand} />
              <form
                className="mt-4 flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  const v = e.target.command.value.trim()
                  if (v) { handleVoiceCommand(v); e.target.reset() }
                }}
              >
                <input
                  id="text-command"
                  name="command"
                  className="input flex-1 text-sm"
                  placeholder='Try "arrived" · "delivered" · "failed"'
                />
                <button type="submit" className="btn-primary px-4">→</button>
              </form>
            </div>
          </div>
        )}

        {/* Broadcast loading */}
        {broadcastLoading && (
          <div className="px-5 mt-4">
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3"
              style={{
                background: 'rgba(13,115,119,0.05)',
                border: '1px solid rgba(13,115,119,0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{
                  border: '2px solid rgba(13,115,119,0.2)',
                  borderTopColor: '#0d7377',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <p className="text-sm font-semibold" style={{ color: '#0d7377' }}>Finding nearby hubs…</p>
            </div>
          </div>
        )}

        {showBroadcast && hubs && !broadcastLoading && (
          <div className="px-5 mt-4 pb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#0d7377' }} />
                <h2 className="text-sm font-bold" style={{ color: '#111117' }}>
                  Nearby Hubs ({hubs.length})
                </h2>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="text-xs font-semibold" style={{ color: '#9898a8' }}>
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

        <div className="flex-1 min-h-8" />
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
