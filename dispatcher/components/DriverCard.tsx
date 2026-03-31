import type { DispatcherDriver } from '@/lib/types'

interface DriverCardProps {
  driver: DispatcherDriver
  onAssign: () => void
}

function trustRingColor(score: number): string {
  if (score >= 90) return 'border-teal'
  if (score >= 75) return 'border-amber-400'
  return 'border-red-400'
}

function trustTextColor(score: number): string {
  if (score >= 90) return 'text-teal'
  if (score >= 75) return 'text-amber-400'
  return 'text-red-400'
}

export default function DriverCard({ driver, onAssign }: DriverCardProps) {
  const progress = driver.today_assigned > 0
    ? Math.round((driver.today_completed / driver.today_assigned) * 100)
    : 0

  return (
    <div className="bg-surface rounded-xl border border-slate-700/30 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Trust score ring */}
          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${trustRingColor(driver.trust_score)}`}>
            <span className={`text-xs font-bold ${trustTextColor(driver.trust_score)}`}>
              {driver.trust_score}
            </span>
          </div>
          <div>
            <p className="text-white font-medium text-sm">{driver.name}</p>
            <p className="text-slate-500 text-xs">{driver.phone ?? '—'}</p>
          </div>
        </div>
        {/* Active indicator */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${driver.is_active ? 'bg-teal animate-pulse' : 'bg-slate-600'}`} />
          <span className={`text-xs ${driver.is_active ? 'text-teal' : 'text-slate-500'}`}>
            {driver.is_active ? 'Active' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{driver.today_completed} completed</span>
          <span>{driver.today_assigned} assigned</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {driver.today_failed > 0 && (
          <p className="text-xs text-red-400 mt-1">{driver.today_failed} failed</p>
        )}
      </div>

      {/* Assign button */}
      <button
        onClick={onAssign}
        className="mt-auto w-full rounded-lg bg-teal/10 text-teal border border-teal/30 py-2 text-xs font-semibold hover:bg-teal hover:text-navy transition-colors"
      >
        Assign Deliveries
      </button>
    </div>
  )
}
