import { MessageSquare } from 'lucide-react';

function Contact() {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Thanks! A DP World representative will reach out to you within 24 hours.");
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <MessageSquare size={36} color="var(--accent-secondary)" />
          Contact DP World
        </h1>
        <p className="page-description">
          Happy with your FreightIQ estimate or need a custom solution? Reach out directly to our logistics experts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card">
        <div className="form-group">
          <label className="form-label">Company Name</label>
          <input required className="input-field" placeholder="E.g. Surat Textiles Ltd." />
        </div>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input type="email" required className="input-field" placeholder="you@company.com" />
        </div>
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">How can we help?</label>
          <textarea required className="input-field" rows="4" placeholder="Mention your FreightIQ estimate or specific requirements..." style={{ resize: 'vertical' }}></textarea>
        </div>
        
        <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Send Message
        </button>
      </form>
    </div>
  );
}

export default Contact;
