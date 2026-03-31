import type { DeliveryListItem, DeliveryStatus } from '@/lib/types'

export function statusChip(status: DeliveryStatus | string) {
  const map: Record<string, { label: string; cls: string }> = {
    en_route:      { label: 'En Route',      cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40' },
    arrived:       { label: 'Arrived',        cls: 'bg-violet-900/40 text-violet-300 border-violet-700/40' },
    delivered:     { label: 'Delivered',      cls: 'bg-teal/15 text-teal border-teal/30' },
    failed:        { label: 'Failed',         cls: 'bg-red-900/40 text-red-300 border-red-700/40' },
    hub_delivered: { label: 'Hub Delivered',  cls: 'bg-teal/15 text-teal border-teal/30' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-700 text-slate-300 border-slate-600' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

interface DeliveryTableProps {
  deliveries: DeliveryListItem[]
  loading: boolean
  onSelect: (d: DeliveryListItem) => void
}

export default function DeliveryTable({ deliveries, loading, onSelect }: DeliveryTableProps) {
  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-slate-700/30 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 border-b border-slate-700/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (deliveries.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-slate-700/30 flex items-center justify-center h-48 text-slate-500 text-sm">
        No deliveries match the current filters.
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-slate-700/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Delivery ID</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Address</th>
              <th className="px-4 py-3 text-left font-medium">Driver</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Batch</th>
              <th className="px-4 py-3 text-left font-medium">Queue #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {deliveries.map(d => (
              <tr
                key={d.id}
                onClick={() => onSelect(d)}
                className="hover:bg-slate-700/20 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-teal font-mono text-xs">{d.order_id}</td>
                <td className="px-4 py-3 text-slate-300">{d.recipient_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 max-w-xs">
                  <span title={d.address}>
                    {d.address.length > 40 ? d.address.slice(0, 40) + '…' : d.address}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{d.driver_name ?? '—'}</td>
                <td className="px-4 py-3">{statusChip(d.status)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{d.batch_code ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{d.queue_position ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
