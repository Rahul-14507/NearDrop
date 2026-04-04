import { useState, useRef, useEffect } from 'react';
import { Send, LineChart, Loader2, Sparkles, Download, Printer, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const QuotationSkeleton = () => (
  <div className="animate-fade-in">
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '2rem' }} />
    
    <div className="skeleton-table-row skeleton" />
    <div className="skeleton-table-row skeleton" />
    <div className="skeleton-table-row skeleton" />
    <div className="skeleton-table-row skeleton" style={{ marginBottom: '2rem' }} />

    <div className="skeleton skeleton-text" style={{ width: '100%' }} />
    <div className="skeleton skeleton-text" style={{ width: '90%' }} />
    <div className="skeleton skeleton-text" style={{ width: '95%' }} />
  </div>
);

function FreightIQ() {
  const [stage, setStage] = useState('form'); // 'form' | 'result'
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    cargo_type: '',
    weight: '',
    timeline: '',
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const resultRef = useRef(null);

  const handleStartEstimate = async (e) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination) return;
    
    setStage('result');
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/public/freight-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, history: [] })
      });
      
      const data = await response.json();
      setMessages([
        { role: 'model', content: data.reply }
      ]);
    } catch (error) {
      setMessages([
        { role: 'model', content: '## Error\n\nSorry, I am unable to connect to the FreightIQ engine at the moment. Please try again later.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    const contextHistory = [...messages, { role: 'user', content: userMsg }];
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/public/freight-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, history: contextHistory })
      });
      
      const data = await response.json();
      setMessages([...contextHistory, { role: 'model', content: data.reply }]);
    } catch (error) {
      setMessages([...contextHistory, { role: 'model', content: 'Connection error while refining your quotation.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const latestQuote = [...messages].reverse().find(m => m.role === 'model')?.content;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <LineChart size={36} color="var(--accent-primary)" />
          FreightIQ Intelligence
        </h1>
        <p className="page-description">
          Generate professional market-indexed quotations and validate your freight costs using global logistics signals.
        </p>
      </div>

      {stage === 'form' ? (
        <form onSubmit={handleStartEstimate} className="glass-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Origin (City/Port)</label>
              <input required className="input-field" placeholder="e.g., Surat, India" value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination (City/Port)</label>
              <input required className="input-field" placeholder="e.g., Dubai, UAE" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cargo Type</label>
              <input required className="input-field" placeholder="e.g., Textiles, Electronics" value={formData.cargo_type} onChange={e => setFormData({...formData, cargo_type: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Volume / Weight</label>
              <input required className="input-field" placeholder="e.g., 2 TEU Containers" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
              <label className="form-label">Timeline / Urgency</label>
              <input required className="input-field" placeholder="e.g., Need it shipped next week" value={formData.timeline} onChange={e => setFormData({...formData, timeline: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Generate Market Quotation
          </button>
        </form>
      ) : (
        <div className="quotation-container">
          <div className="quotation-paper" ref={resultRef}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>REF: FIQ-{new Date().getTime().toString().slice(-6)}</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.5rem' }} onClick={() => window.print()} title="Print">
                  <Printer size={16} />
                </button>
                <button className="btn-secondary" style={{ padding: '0.5rem' }} title="Download PDF">
                  <Download size={16} />
                </button>
              </div>
            </div>

            {isLoading && !latestQuote ? (
              <QuotationSkeleton />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {latestQuote}
              </ReactMarkdown>
            )}
            
            {isLoading && latestQuote && (
              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                <Loader2 className="lucide-spin" size={18} />
                Updating current quotation with new market data...
              </div>
            )}
          </div>

          {!isLoading && latestQuote && (
            <div className="refine-section no-print">
              <label className="refine-label">
                <Sparkles size={16} color="var(--accent-primary)" />
                Need to adjust the cargo or negotiate further?
              </label>
              <form onSubmit={handleSendMessage} className="refine-input-group">
                <input 
                  className="input-field" 
                  placeholder="e.g., Adjust the quantity, or ask for air freight comparison..." 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isLoading}
                />
                <button type="submit" className="btn-primary" disabled={isLoading} style={{ whiteSpace: 'nowrap' }}>
                  {isLoading ? <Loader2 className="lucide-spin" size={18} /> : <RefreshCw size={18} />}
                  <span style={{ marginLeft: '0.5rem' }}>Refine Quote</span>
                </button>
              </form>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button className="btn-secondary" onClick={() => { setStage('form'); setMessages([]); }}>
              Start New Quotation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FreightIQ;
