/**
 * dispatcherRoutes.tsx
 * ------------------------------------------------------------------
 * Modular route configuration for the Dispatcher Portal module.
 *
 * Mount these routes in the main application router:
 *
 *   import { dispatcherRoutes } from './modules/dispatcher/routes/dispatcherRoutes';
 *   // In your <Routes>:
 *   {dispatcherRoutes}
 *
 * Routes:
 *   /dispatcher           → Dashboard
 *   /dispatcher/incidents → Incident Queue
 *   /dispatcher/map       → Live Dispatch Map
 * ------------------------------------------------------------------
 */

import { Route, Navigate } from 'react-router-dom';
import { DispatcherShell } from '../components/layout/DispatcherShell';
import { LoginPage } from '../pages/LoginPage';
import { AuthGuard } from '../components/auth/AuthGuard';
import { DashboardPage } from '../pages/DashboardPage';
import { IncidentsPage } from '../pages/IncidentsPage';
import { MapPage } from '../pages/MapPage';
import { RidersPage } from '../pages/RidersPage';
import { AlertsPage } from '../pages/AlertsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { DispatchCenterPage } from '../pages/DispatchCenterPage';

/**
 * Dispatcher route subtree.
 * Wrapped in DispatcherShell for layout.
 * Ready to be composed into a parent router.
 */
export const dispatcherRoutes = (
  <>
    <Route path="/dispatcher/login" element={<LoginPage />} />
    <Route 
      path="/dispatcher" 
      element={
        <AuthGuard>
          <DispatcherShell />
        </AuthGuard>
      }
    >
      <Route index element={<DashboardPage />} />
      <Route path="incidents" element={<IncidentsPage />} />
      <Route path="map" element={<MapPage />} />
      <Route path="riders" element={<RidersPage />} />
      <Route path="alerts" element={<AlertsPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="dispatch" element={<DispatchCenterPage />} />
      {/* Fallback: redirect unknown sub-paths to dashboard */}
      <Route path="*" element={<Navigate to="/dispatcher" replace />} />
    </Route>
  </>
);
