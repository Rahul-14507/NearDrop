'use client'

import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'
import { uploadBatch } from '@/lib/api'
import type { CsvRow, DispatcherDriver } from '@/lib/types'

const REQUIRED_COLS = ['delivery_id', 'customer_name', 'customer_email', 'customer_phone', 'delivery_address']

interface CSVUploadModalProps {
  driver: DispatcherDriver
  onClose: () => void
  onSuccess: (batchCode: string) => void
}

function validateRows(rows: CsvRow[]): CsvRow[] {
  return rows.map(row => {
    const errors: string[] = []
    if (!row.delivery_id?.trim()) errors.push('delivery_id')
    if (!row.customer_name?.trim()) errors.push('customer_name')
    if (!row.customer_email?.trim()) errors.push('customer_email')
    if (!row.delivery_address?.trim()) errors.push('delivery_address')
    return { ...row, _errors: errors }
  })
}

export default function CSVUploadModal({ driver, onClose, onSuccess }: CSVUploadModalProps) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function parseFile(f: File) {
    setFile(f)
    setApiError(null)
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const validated = validateRows(results.data)
        setRows(validated)
      },
      error(err) {
        setApiError(`CSV parse error: ${err.message}`)
      },
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }, [])

  const errorCount = rows.filter(r => (r._errors?.length ?? 0) > 0).length
  const canSubmit = file !== null && rows.length > 0 && errorCount === 0

  async function handleSubmit() {
    if (!file || !canSubmit) return
    setUploading(true)
    setApiError(null)
    try {
      const result = await uploadBatch(file, driver.id)
      onSuccess(result.batch_code)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg bg-surface border-l border-slate-700/50 shadow-2xl flex flex-col transition-transform"
        style={{ transform: 'translateX(0)', animation: 'slideInRight 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Assign deliveries</h2>
            <p className="text-slate-400 text-xs mt-0.5">to {driver.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl py-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragOver ? 'border-teal bg-teal/10' : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-slate-300 text-sm">Drop CSV here or <span className="text-teal">browse</span></p>
              <p className="text-slate-500 text-xs mt-0.5">Required columns: delivery_id, customer_name, customer_email, customer_phone, delivery_address</p>
            </div>
            {file && <p className="text-teal text-xs font-medium">{file.name}</p>}
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-xs font-medium">
                  {rows.length} deliveries found
                </p>
                {errorCount > 0 && (
                  <p className="text-red-400 text-xs font-medium">Fix {errorCount} error{errorCount !== 1 ? 's' : ''} before uploading</p>
                )}
              </div>
              <div className="bg-navy rounded-lg border border-slate-700/50 overflow-auto max-h-64">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      {['ID', 'Name', 'Email', 'Phone', 'Address'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {rows.slice(0, 5).map((row, i) => {
                      const hasError = (row._errors?.length ?? 0) > 0
                      return (
                        <tr key={i} className={hasError ? 'bg-red-900/20' : ''}>
                          <td className={`px-3 py-2 ${row._errors?.includes('delivery_id') ? 'text-red-400' : 'text-slate-300'}`}>{row.delivery_id || '—'}</td>
                          <td className={`px-3 py-2 ${row._errors?.includes('customer_name') ? 'text-red-400' : 'text-slate-300'}`}>{row.customer_name || '—'}</td>
                          <td className={`px-3 py-2 ${row._errors?.includes('customer_email') ? 'text-red-400' : 'text-slate-400'}`}>{row.customer_email || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{row.customer_phone || '—'}</td>
                          <td className={`px-3 py-2 ${row._errors?.includes('delivery_address') ? 'text-red-400' : 'text-slate-400'} max-w-xs truncate`}>{row.delivery_address || '—'}</td>
                        </tr>
                      )
                    })}
                    {rows.length > 5 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-slate-500 text-center">
                          …and {rows.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {apiError && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="w-full rounded-lg bg-teal py-3 text-sm font-semibold text-navy hover:bg-teal-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading
              ? 'Uploading…'
              : canSubmit
                ? `Assign to ${driver.name}`
                : rows.length === 0
                  ? 'Upload a CSV to continue'
                  : `Fix ${errorCount} error${errorCount !== 1 ? 's' : ''} to continue`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
