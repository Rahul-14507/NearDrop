import { Link, useLocation } from 'react-router-dom';
import { Package, LineChart, MessageSquare } from 'lucide-react';

function Navigation() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <Package size={24} />
        NearDrop Global
      </Link>
      <div className="nav-links">
        <Link to="/estimate" className={`nav-link ${isActive('/estimate')}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LineChart size={18} />
            FreightIQ Quotes
          </div>
        </Link>
        <Link to="/track" className={`nav-link ${isActive('/track')}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} />
            Track Shipment
          </div>
        </Link>
        <Link to="/contact" className={`nav-link ${isActive('/contact')}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={18} />
            Contact DP World
          </div>
        </Link>
      </div>
    </nav>
  );
}

export default Navigation;
