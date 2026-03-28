import { MapPin, Package, User, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../../components/ui/Badge'
import { DeliveryMap } from '../../components/maps/LeafletMap'

const DELIVERY_COORDS = { lat: 17.4239, lng: 78.4738 }

const STATUS_META = {
  en_route:  { label: 'Mark Arrived',   buttonClass: 'btn-primary', icon: ChevronRight },
  arrived:   { label: 'Mark Delivered', buttonClass: 'btn-primary', icon: CheckCircle  },
  delivered: { label: null, final: true },
  failed:    { label: null, final: true },
}

export default function DeliveryCard({ delivery, onStatusChange }) {
  if (!delivery) return null

  const meta = STATUS_META[delivery.status] ?? STATUS_META.en_route
  const isFailed = delivery.status === 'failed'
  const isDelivered = delivery.status === 'delivered'
  const NextIcon = meta.icon

  return (
    <div className="delivery-card animate-fade-in">
      {/* Status accent stripe */}
      <div
        style={{
          height: 3,
          background: isFailed
            ? 'linear-gradient(90deg, #ef4444, #f97316)'
            : isDelivered
            ? 'linear-gradient(90deg, #00c9b1, #34d399)'
            : 'linear-gradient(90deg, #fbbf24, #00c9b1)',
        }}
      />

      {/* Map */}
      <div style={{ height: 180 }}>
        <DeliveryMap lat={DELIVERY_COORDS.lat} lng={DELIVERY_COORDS.lng} height="180px" />
      </div>

      {/* Info */}
      <div className="p-4 space-y-4">
        {/* Address + status */}
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(96,165,250,0.1)' }}
          >
            <MapPin className="w-4 h-4" style={{ color: '#60a5fa' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">{delivery.address}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={delivery.status} />
            </div>
          </div>
        </div>

        {/* Meta chips */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <User className="w-3 h-3" />
            <span>{delivery.recipient_name}</span>
          </div>
          <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Package className="w-3 h-3" />
            <span className="capitalize">{delivery.package_size}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span>{delivery.weight_kg}kg</span>
          </div>
          <div className="ml-auto font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            #{delivery.order_id}
          </div>
        </div>

        {/* Action area */}
        {!meta.final ? (
          <div className="flex gap-2">
            <button
              id={`btn-status-${delivery.status}`}
              onClick={() => {
                const statusOrder = ['en_route', 'arrived', 'delivered']
                const idx = statusOrder.indexOf(delivery.status)
                if (idx >= 0 && idx < statusOrder.length - 1) onStatusChange(statusOrder[idx + 1])
              }}
              className={`${meta.buttonClass} flex-1 text-sm`}
            >
              {NextIcon && <NextIcon className="w-4 h-4" />}
              {meta.label}
            </button>

            <button
              id="btn-fail-delivery"
              onClick={() => onStatusChange('failed')}
              className="btn-danger text-sm px-4"
            >
              <AlertTriangle className="w-4 h-4" />
              Fail
            </button>
          </div>
        ) : (
          <div className={`
            flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
            ${isDelivered
              ? 'text-emerald-400'
              : 'text-red-400'
            }
          `}
          style={{
            background: isDelivered ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isDelivered ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {isDelivered
              ? <><CheckCircle className="w-4 h-4" /> Delivered Successfully</>
              : <><AlertTriangle className="w-4 h-4" /> Delivery Failed — Rerouting</>
            }
          </div>
        )}
      </div>
    </div>
  )
}
