import { Link } from 'react-router-dom';
import { LineChart, Package, MessageSquare } from 'lucide-react';

function Home() {
  return (
    <div className="animate-fade-in" style={{ textAlign: 'center', marginTop: '4rem' }}>
      <div className="page-header">
        <h1 className="page-title">Welcome to NearDrop Public Portal</h1>
        <p className="page-description">
          Open, transparent tools for both shippers and receivers. Track live shipments or get market-intelligent freight quotes powered by FreightIQ.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '4rem' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--accent-gradient)', padding: '1rem', borderRadius: '50%' }}>
            <LineChart size={32} color="white" />
          </div>
          <h3>FreightIQ Estimation</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Get instant, AI-driven market rates for your cargo. Validate your freight forwarder quotes against global indices.
          </p>
          <Link to="/estimate" className="btn-primary" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>
            Get an Estimate
          </Link>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '1rem', borderRadius: '50%' }}>
            <Package size={32} color="var(--success)" />
          </div>
          <h3>Track Your Shipment</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            No login required. Track your incoming container or package in real-time with just your tracking ID.
          </p>
          <Link to="/track" className="btn-secondary" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>
            Track Delivery
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
