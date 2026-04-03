import { useState, useRef, useEffect } from 'react';
import { Send, LineChart, Loader2 } from 'lucide-react';

function FreightIQ() {
  const [stage, setStage] = useState('form'); // 'form' | 'chat'
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
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStartEstimate = async (e) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination) return;
    
    setStage('chat');
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/public/freight-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, history: [] })
      });
      
      const data = await response.json();
      setMessages([
        { role: 'user', content: `I want to ship ${formData.weight} of ${formData.cargo_type} from ${formData.origin} to ${formData.destination}. Timeline: ${formData.timeline}. What is the current market rate and what should I know?` },
        { role: 'model', content: data.reply }
      ]);
    } catch (error) {
      setMessages([
        { role: 'model', content: 'Sorry, I am unable to connect to the FreightIQ engine at the moment.' }
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
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/public/freight-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, history: newHistory })
      });
      
      const data = await response.json();
      setMessages([...newHistory, { role: 'model', content: data.reply }]);
    } catch (error) {
      setMessages([...newHistory, { role: 'model', content: 'Connection error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <LineChart size={36} color="var(--accent-primary)" />
          FreightIQ Intelligence
        </h1>
        <p className="page-description">
          Provide your cargo details below. We'll scrape live rate signals from public indices (e.g. Freightos, Xeneta) and validate your quotes.
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
            Generate Market Estimate
          </button>
        </form>
      ) : (
        <div className="glass-card chat-container">
          <div className="chat-history">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'model' ? 'ai' : 'user'}`} style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="chat-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 className="lucide-spin" size={18} />
                Analyzing market signals...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="chat-input-area">
            <input 
              className="input-field" 
              placeholder="E.g., Format the quote for me to reply, or what if I ship by air?" 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default FreightIQ;
