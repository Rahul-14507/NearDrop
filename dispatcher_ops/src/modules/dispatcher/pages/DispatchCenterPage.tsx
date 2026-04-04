import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithAuth } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { useCityStore } from '../store/cityStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  id: number;
  name: string;
  is_active: boolean;
  today_assigned: number;
  today_completed: number;
  today_failed: number;
  city: string;
}

interface BatchDelivery {
  id: number;
  order_id: string;
  address: string;
  status: string;
  recipient_name: string | null;
  queue_position: number | null;
}

interface Batch {
  batch_code: string;
  driver_id: number;
  driver_name: string;
  city: string;
  total_deliveries: number;
  deliveries: BatchDelivery[];
  uploadedAt?: string;
  // Live counts — updated from WS
  completed?: number;
  failed?: number;
}

// ─── CSV Preview Table ───────────────────────────────────────────────────────

const REQUIRED_COLS = ['delivery_id', 'customer_name', 'customer_email', 'customer_phone', 'delivery_address'];

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } | null {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

// ─── Dispatch Center Page ─────────────────────────────────────────────────────

export const DispatchCenterPage: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const selectedCity = useCityStore(s => s.selectedCity);

  // Driver list
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [driversLoading, setDriversLoading] = useState(true);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Batches list (live)
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // ── Load drivers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setDriversLoading(true);
      try {
        const query = selectedCity && selectedCity !== 'All Cities' ? `?city=${encodeURIComponent(selectedCity)}` : '';
        const r = await fetchWithAuth(`/api/dispatcher/drivers${query}`);
        const data = await r.json();
        setDrivers(Array.isArray(data) ? data : data.drivers ?? []);
      } catch { /* ignore */ } finally {
        setDriversLoading(false);
      }
    };
    load();
  }, [selectedCity]);

  // ── Load batches ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setBatchesLoading(true);
      try {
        const query = selectedCity && selectedCity !== 'All Cities' ? `?city=${encodeURIComponent(selectedCity)}` : '';
        const r = await fetchWithAuth(`/api/dispatcher/batches${query}`);
        const data = await r.json();
        const list: Batch[] = Array.isArray(data) ? data : data.batches ?? [];
        // Enrich with live counts
        setBatches(list.map(b => ({
          ...b,
          completed: b.deliveries?.filter(d => d.status === 'delivered').length ?? 0,
          failed: b.deliveries?.filter(d => d.status === 'failed' || d.status === 'hub_delivered').length ?? 0,
        })));
      } catch { /* ignore */ } finally {
        setBatchesLoading(false);
      }
    };
    load();
  }, [selectedCity]);

  // ── WebSocket live updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const { type, data, payload } = event;
        const msg = data ?? payload ?? {};

        if (type === 'batch_assigned') {
          // New batch just uploaded — add to list
          setBatches(prev => {
            const driver = drivers.find(d => d.id === msg.driver_id);
            const driverName = driver?.name ?? `Driver #${msg.driver_id}`;
            const driverCity = driver?.city ?? 'Unknown';
            return [{
              batch_code: msg.batch_code,
              driver_id: msg.driver_id,
              driver_name: driverName,
              city: driverCity,
              total_deliveries: msg.total_deliveries,
              deliveries: msg.deliveries ?? [],
              uploadedAt: new Date().toISOString(),
              completed: 0,
              failed: 0,
            }, ...prev];
          });
        }

        if (type === 'delivery_completed') {
          setBatches(prev => prev.map(b => {
            const hasDelivery = b.deliveries.some(d => d.id === msg.delivery_id);
            if (!hasDelivery) return b;
            return {
              ...b,
              deliveries: b.deliveries.map(d =>
                d.id === msg.delivery_id ? { ...d, status: 'delivered' } : d
              ),
              completed: (b.completed ?? 0) + 1,
            };
          }));
        }

        if (type === 'delivery_failed') {
          setBatches(prev => prev.map(b => {
            const hasDelivery = b.deliveries.some(d => d.id === msg.delivery_id);
            if (!hasDelivery) return b;
            return {
              ...b,
              deliveries: b.deliveries.map(d =>
                d.id === msg.delivery_id ? { ...d, status: 'failed' } : d
              ),
              failed: (b.failed ?? 0) + 1,
            };
          }));
        }

        if (type === 'batch_complete') {
          setBatches(prev => prev.map(b =>
            b.batch_code === msg.batch_code
              ? { ...b, completed: msg.delivered, failed: msg.hub_drops }
              : b
          ));
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [token, drivers]);

  // ── CSV Handling ──────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setCsvError(null);
    setCsvPreview(null);
    if (!file.name.endsWith('.csv')) {
      setCsvError('Please upload a CSV file (.csv)');
      return;
    }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvText(text);
      if (!parsed || parsed.rows.length === 0) {
        setCsvError('CSV file is empty or could not be parsed.');
        return;
      }
      const missing = REQUIRED_COLS.filter(c => !parsed.headers.includes(c));
      if (missing.length > 0) {
        setCsvError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Upload ────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!csvFile || !selectedDriverId) return;
    setUploading(true);
    setUploadError(null);

    const form = new FormData();
    form.append('file', csvFile);
    form.append('driver_id', String(selectedDriverId));

    try {
      const r = await fetchWithAuth('/api/dispatcher/batch/upload', {
        method: 'POST',
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Upload failed (${r.status})`);
      }
      await r.json();
      // Reset form
      setCsvFile(null);
      setCsvPreview(null);
      setSelectedDriverId(null);
    } catch (err: any) {
      setUploadError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  const statusColor: Record<string, string> = {
    en_route: '#3b82f6',
    delivered: '#10b981',
    failed: '#ef4444',
    hub_delivered: '#f59e0b',
    pending: '#64748b',
  };

  const statusLabel: Record<string, string> = {
    en_route: 'En Route',
    delivered: 'Delivered',
    failed: 'Failed',
    hub_delivered: 'Hub Drop',
    pending: 'Pending',
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dispatch Center</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign delivery batches to drivers via CSV upload — updates push live to the driver app
        </p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* LEFT: Upload panel */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-5" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">New Batch Assignment</h3>

          {/* Driver selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Driver
            </label>
            {driversLoading ? (
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <select
                id="driver-select"
                value={selectedDriverId ?? ''}
                onChange={e => setSelectedDriverId(Number(e.target.value) || null)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white appearance-none"
                style={{ borderColor: '#e2e8f0' }}
              >
                <option value="">-- Choose a driver --</option>
                {drivers
                  .filter(d => d.is_active && (selectedCity === 'All Cities' || d.city === selectedCity))
                  .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city}) — Today: {d.today_assigned} assigned / {d.today_completed} done
                  </option>
                ))}
              </select>
            )}
            {selectedDriver && (
              <div className="mt-2 flex gap-3">
                {[
                  { label: 'Assigned', value: selectedDriver.today_assigned, color: '#3b82f6' },
                  { label: 'Completed', value: selectedDriver.today_completed, color: '#10b981' },
                  { label: 'Failed', value: selectedDriver.today_failed, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} className="flex-1 text-center bg-slate-50 rounded-lg py-2 border border-slate-100">
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CSV Drop zone */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Delivery CSV
            </label>
            <div
              id="csv-drop-zone"
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
              style={{
                borderColor: isDragging ? '#3b82f6' : csvPreview ? '#10b981' : '#cbd5e1',
                background: isDragging ? 'rgba(59,130,246,0.04)' : csvPreview ? 'rgba(16,185,129,0.04)' : '#fafbfc',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {csvPreview ? (
                <div className="space-y-1">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{csvFile?.name}</p>
                  <p className="text-xs text-slate-500">{csvPreview.rows.length} deliveries • click to replace</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-600">Drag & drop your CSV here</p>
                  <p className="text-xs text-slate-400">or click to browse</p>
                </div>
              )}
            </div>

            {/* Required columns hint */}
            <div className="mt-2 flex flex-wrap gap-1">
              {REQUIRED_COLS.map(c => (
                <span key={c} className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                  {c}
                </span>
              ))}
            </div>

            {csvError && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-xs font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {csvError}
              </div>
            )}
          </div>

          {/* CSV Preview table */}
          {csvPreview && (
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
              <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between" style={{ borderColor: '#e2e8f0' }}>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Preview ({csvPreview.rows.length} rows)</span>
                <button onClick={() => { setCsvFile(null); setCsvPreview(null); }} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Clear
                </button>
              </div>
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50">
                      {csvPreview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        {csvPreview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-slate-700 truncate max-w-[120px]" title={row[h]}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                    {csvPreview.rows.length > 5 && (
                      <tr>
                        <td colSpan={csvPreview.headers.length} className="px-3 py-2 text-center text-slate-400 italic">
                          +{csvPreview.rows.length - 5} more rows...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {uploadError}
            </div>
          )}

          {/* Assign button */}
          <button
            id="assign-batch-btn"
            onClick={handleUpload}
            disabled={!csvFile || !selectedDriverId || uploading || !!csvError}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assigning batch...
              </div>
            ) : (
              `🚀 Assign ${csvPreview?.rows.length ?? 0} deliveries to ${selectedDriver?.name ?? 'driver'}`
            )}
          </button>
        </div>

        {/* RIGHT: Live batch tracker */}
        <div className="bg-white rounded-2xl shadow-sm border flex flex-col" style={{ borderColor: '#e2e8f0' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e2e8f0' }}>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Live Batch Tracker</h3>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#f1f5f9' }}>
            {batchesLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : batches.filter(b => selectedCity === 'All Cities' || b.city === selectedCity).length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <svg className="w-10 h-10 mx-auto opacity-30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm font-medium">No batches in {selectedCity}</p>
                <p className="text-xs mt-1">Upload a CSV to create a batch for this city</p>
              </div>
            ) : (
              batches
                .filter(b => selectedCity === 'All Cities' || b.city === selectedCity)
                .map(batch => {
                const total = batch.total_deliveries;
                const done = batch.completed ?? 0;
                const failed = batch.failed ?? 0;
                const pending = total - done - failed;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isExpanded = expandedBatch === batch.batch_code;

                return (
                  <div key={batch.batch_code} className="border-b last:border-0" style={{ borderColor: '#f1f5f9' }}>
                    <button
                      className="w-full px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
                      onClick={() => setExpandedBatch(isExpanded ? null : batch.batch_code)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{batch.batch_code}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            🚗 {batch.driver_name} • {total} deliveries
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xl font-black" style={{ color: pct === 100 ? '#10b981' : '#3b82f6' }}>{pct}%</span>
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                          }}
                        />
                      </div>

                      {/* Counts */}
                      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-emerald-600">{done} delivered</span>
                        <span className="text-amber-600">{pending} pending</span>
                        <span className="text-red-500">{failed} failed</span>
                      </div>
                    </button>

                    {/* Expanded delivery rows */}
                    {isExpanded && (
                      <div className="px-6 pb-4 space-y-1 bg-slate-50/50">
                        {(batch.deliveries ?? [])
                          .sort((a, b) => (a.queue_position ?? 99) - (b.queue_position ?? 99))
                          .map(d => (
                            <div key={d.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: statusColor[d.status] ?? '#64748b' }}
                              />
                              <span className="text-[11px] font-mono text-slate-600 w-20 shrink-0">{d.order_id}</span>
                              <span className="text-[11px] text-slate-700 flex-1 truncate">{d.address}</span>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                style={{
                                  color: statusColor[d.status] ?? '#64748b',
                                  background: `${statusColor[d.status] ?? '#64748b'}18`,
                                }}
                              >
                                {statusLabel[d.status] ?? d.status}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
