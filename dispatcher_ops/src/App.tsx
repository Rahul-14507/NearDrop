import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { dispatcherRoutes } from './modules/dispatcher/routes/dispatcherRoutes';

/**
 * App.tsx
 * ------------------------------------------------------------------
 * Root application component.
 *
 * V1: Directly mounts the Dispatcher Portal module.
 *
 * V2+: Add additional module route subtrees here alongside
 * dispatcherRoutes (e.g., hubRoutes, adminRoutes).
 * ------------------------------------------------------------------
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to dispatcher dashboard */}
        <Route path="/" element={<Navigate to="/dispatcher" replace />} />

        {/* Dispatcher Portal Module */}
        {dispatcherRoutes}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
