'use client'

import { useEffect, useState } from 'react'
import StatsBar from '@/components/StatsBar'
import DriverCard from '@/components/DriverCard'
import CSVUploadModal from '@/components/CSVUploadModal'
import { fetchDrivers } from '@/lib/api'
import type { DispatcherDriver } from '@/lib/types'

export default function DashboardPage() {
  const [drivers, setDrivers] = useState<DispatcherDriver[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState<DispatcherDriver | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  async function loadDrivers() {
    try {
      const data = await fetchDrivers()
      setDrivers(data)
    } catch (err) {
      console.error('Failed to load drivers:', err)
    } finally {
      setLoadingDrivers(false)
    }
  }

  useEffect(() => {
    loadDrivers()
    const interval = setInterval(loadDrivers, 15_000)
    return () => clearInterval(interval)
  }, [])

  function showToast(message: string) {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 4000)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Real-time fleet overview — Hyderabad</p>
      </div>

      {/* Stats strip */}
      <StatsBar />

      {/* Driver grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Fleet</h2>
          <span className="text-xs text-slate-500">Auto-refreshes every 15s</span>
        </div>

        {loadingDrivers ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-surface rounded-xl h-44 animate-pulse border border-slate-700/30" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drivers.map(driver => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onAssign={() => setSelectedDriver(driver)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CSV upload modal */}
      {selectedDriver && (
        <CSVUploadModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onSuccess={batchCode => {
            setSelectedDriver(null)
            showToast(`Batch ${batchCode} assigned to ${selectedDriver.name}`)
            loadDrivers()
          }}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-teal text-navy text-sm font-medium px-5 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
