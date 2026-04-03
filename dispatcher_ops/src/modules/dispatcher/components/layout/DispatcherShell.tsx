import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * DispatcherShell
 * ------------------------------------------------------------------
 * The root layout wrapper for all dispatcher routes.
 * - Fixed sidebar (240px wide)
 * - Fixed top bar (64px tall)
 * - Scrollable main content area
 * ------------------------------------------------------------------
 */
export const DispatcherShell: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
      <Sidebar />
      <TopBar />

      {/* Main content area — offset by sidebar width and topbar height */}
      <main
        style={{
          marginLeft: '240px',
          paddingTop: '64px',
          minHeight: '100vh',
        }}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
