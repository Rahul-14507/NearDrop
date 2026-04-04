import { useState } from 'react';
import { Package, Search, MapPin, Truck, CheckCircle } from 'lucide-react';
import { apiFetch } from '../api/apiClient';

function Tracking() {
  const [trackingId, setTrackingId] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setIsLoading(true);
    setError('');
    setTrackingData(null);

    try {
      const response = await apiFetch(`/public/track/${trackingId.trim()}`);
      if (!response.ok) {
        throw new Error('Shipment not found');
      }
      const data = await response.json();
      setTrackingData(data);
    } catch (err) {
      setError(err.message || 'Could not fetch tracking details. Please verify your ID.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Package size={36} color="var(--success)" />
          Track Shipment
        </h1>
        <p className="page-description">
          Enter your global tracking ID or order reference to see live updates. No login required.
        </p>
      </div>

      <form onSubmit={handleTrack} style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
        <input 
          className="input-field" 
          placeholder="e.g. ND10126-001-1" 
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Track'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '8px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {trackingData && (
        <div className="glass-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Order #{trackingData.order_id}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Recipient: {trackingData.recipient_name || 'Confidential'}</p>
            </div>
            <div style={{ background: 'var(--accent-gradient)', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
              {trackingData.status.toUpperCase().replace('_', ' ')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
             {/* Progress line visualization could go here */}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '50%' }}>
                <CheckCircle size={20} color="var(--success)" />
              </div>
              <div>
                <h4 style={{ margin: 0 }}>Order Processed</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Information received by DP World.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '50%' }}>
                <Truck size={20} color={['en_route', 'arrived', 'delivered', 'hub_delivered'].includes(trackingData.status) ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              </div>
              <div>
                <h4 style={{ margin: 0, color: ['en_route', 'arrived', 'delivered', 'hub_delivered'].includes(trackingData.status) ? 'white' : 'var(--text-secondary)' }}>
                  In Transit {trackingData.driver_name ? `with ${trackingData.driver_name}` : ''}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  Destination: {trackingData.address}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '50%' }}>
                <MapPin size={20} color={['delivered', 'hub_delivered'].includes(trackingData.status) ? 'var(--success)' : 'var(--text-secondary)'} />
              </div>
              <div>
                <h4 style={{ margin: 0, color: ['delivered', 'hub_delivered'].includes(trackingData.status) ? 'white' : 'var(--text-secondary)' }}>Delivered</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  {trackingData.status === 'hub_delivered' ? 'Available for pickup at local Hub' : 'Successfully handed to recipient'}
                </p>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

export default Tracking;
