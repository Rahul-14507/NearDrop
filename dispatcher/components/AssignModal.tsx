'use client'

// AssignModal is a thin wrapper kept for backward compatibility.
// The full upload flow lives in CSVUploadModal.
// This component can be used when you already have a batch code and want to
// show assignment confirmation details.

import type { DispatcherDriver } from '@/lib/types'

interface AssignModalProps {
  driver: DispatcherDriver
  batchCode: string
  totalDeliveries: number
  onClose: () => void
}

export default function AssignModal({ driver, batchCode, totalDeliveries, onClose }: AssignModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-slate-700/50 w-full max-w-sm p-6 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-teal/15 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-teal" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-white font-semibold text-lg mb-1">Batch Assigned</h2>
        <p className="text-slate-400 text-sm mb-4">
          <span className="font-mono text-teal">{batchCode}</span> with{' '}
          <span className="text-white font-medium">{totalDeliveries} deliveries</span>{' '}
          has been assigned to <span className="text-white font-medium">{driver.name}</span>.
        </p>
        <p className="text-slate-500 text-xs mb-6">
          The driver will receive a push notification and WebSocket event immediately.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-teal py-2.5 text-sm font-semibold text-navy hover:bg-teal-light transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
