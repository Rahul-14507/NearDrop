import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCityStore } from '../../store/cityStore';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dispatcher': { title: 'Dashboard', subtitle: 'Overview of operations and KPIs' },
  '/dispatcher/incidents': { title: 'Incident Queue', subtitle: 'Manage and resolve active delivery failures' },
  '/dispatcher/map': { title: 'Live Dispatch Map', subtitle: 'Real-time driver and delivery tracking' },
};

export const TopBar: React.FC = () => {
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] ?? { title: 'Dispatcher', subtitle: 'NearDrop Ops' };
  
  const [nowDate, setNowDate] = useState(new Date());

  const { selectedCity, availableCities, setSelectedCity } = useCityStore();

  useEffect(() => {
    const timer = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = nowDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const today = nowDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header
      className="fixed top-0 right-0 z-10 flex items-center justify-between px-8 border-b"
      style={{
        left: '240px',
        height: '64px',
        background: 'rgba(248, 250, 252, 0.92)',
        backdropFilter: 'blur(12px)',
        borderColor: '#e2e8f0',
      }}
    >
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-bold text-slate-800 leading-tight">{pageInfo.title}</h1>
        <p className="text-xs text-slate-500">{pageInfo.subtitle}</p>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-4">
        {/* City Selector */}
        <div className="flex items-center">
          <label htmlFor="city-selector" className="text-xs font-semibold tracking-wide text-slate-500 mr-2 uppercase">
            Operations City
          </label>
          <select
            id="city-selector"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            {availableCities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1 border-r border-slate-200"></div>

        {/* Sync Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">System Live</span>
        </div>

        {/* Date/Time */}
        <div className="text-right hidden sm:block border-l pl-4" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-xs font-semibold text-slate-700">Last synced: {now}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{today}</p>
        </div>

        {/* Notification bell */}
        <button
          id="topbar-notifications-btn"
          className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-700"
          title="Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </button>

        {/* Avatar */}
        <div
          id="topbar-avatar"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer select-none"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          title="Dispatcher: Arjun Kumar"
        >
          AK
        </div>
      </div>
    </header>
  );
};
