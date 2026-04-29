import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import './App.css';

const CATEGORIES = ['All', 'Roofing', 'Landscaping', 'Concrete', 'Fencing', 'Flooring', 'Carpentry', 'Plumbing', 'Electrical', 'Other'];

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [selectedJob, setSelectedJob] = useState(null);
  const [bidForm, setBidForm] = useState({ amount: '', message: '' });
  const [bidSuccess, setBidSuccess] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', description: '', price: '', location: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
const [filters, setFilters] = useState({ minPrice: '', maxPrice: '', sortBy: 'newest' });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });
    fetchJobs();
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  }

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (!error) setJobs(data);
    setLoading(false);
  }

  async function fetchConversations() {
    const { data } = await supabase
      .from('messages')
      .select('job_id, sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (data) {
      const unique = [...new Map(data.map(m => [m.job_id, m])).values()];
      setConversations(unique);
    }
  }

  async function fetchMessages(jobId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('job_id', jobId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeConversation) return;
    await supabase.from('messages').insert({
      job_id: activeConversation.job_id,
      sender_id: user.id,
      receiver_id: activeConversation.other_id,
      content: newMessage.trim(),
    });
    setNewMessage('');
    fetchMessages(activeConversation.job_id);
  }

const filtered = jobs
  .filter(j => activeCategory === 'All' || j.category === activeCategory)
  .filter(j => filters.minPrice === '' || Number(j.price) >= Number(filters.minPrice))
  .filter(j => filters.maxPrice === '' || Number(j.price) <= Number(filters.maxPrice))
  .sort((a, b) => {
    switch (filters.sortBy) {
      case 'oldest': return new Date(a.created_at) - new Date(b.created_at);
      case 'price_low': return Number(a.price) - Number(b.price);
      case 'price_high': return Number(b.price) - Number(a.price);
      case 'most_bids': return b.bids - a.bids;
      case 'least_bids': return a.bids - b.bids;
      default: return new Date(b.created_at) - new Date(a.created_at);
    }
  });
  async function handleAuth() {
    setAuthError('');
    setAuthLoading(true);
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
      if (error) setAuthError(error.message);
      else setShowAuthModal(false);
    } else {
      const { data, error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
      if (error) { setAuthError(error.message); }
      else {
        if (authForm.name && data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, name: authForm.name });
        }
        setAuthError('Check your email to confirm your account!');
      }
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  function handleImageChange(e) {
    const files = Array.from(e.target.files);
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  }

  function removeImage(index) {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handlePost() {
  if (!form.title || !form.price) return;
  setPosting(true);
  let imageUrls = [];
  for (const file of imageFiles) {
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('job-images').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('job-images').getPublicUrl(fileName);
      imageUrls.push(data.publicUrl);
    }
  }
  const { error } = await supabase.from('jobs').insert({
    title: form.title,
    category: form.category || 'General',
    description: form.description,
    price: Number(form.price),
    emoji: '📋',
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    location: form.location || 'Your Area',
    user_id: user?.id,
    poster_name: profile?.name || null,
    bids: 0,
  });
  if (!error) {
    fetchJobs();
    setShowPostModal(false);
    setImageFiles([]);
    setImagePreviews([]);
    setForm({ title: '', category: '', description: '', price: '', location: '' });
  }
  setPosting(false);
}
    for (const file of imageFiles) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('job-images').upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from('job-images').getPublicUrl(fileName);
        imageUrls.push(data.publicUrl);
      }
    }
    const { error } = await supabase.from('jobs').insert({
      title: form.title,
      category: form.category || 'General',
      description: form.description,
      price: Number(form.price),
      emoji: '📋',
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      location: form.location || 'Your Area',
      user_id: user?.id,
      poster_name: form.name || profile?.name || null,
      bids: 0,
    });
    if (!error) {
      fetchJobs();
      setShowPostModal(false);
      setImageFiles([]);
      setImagePreviews([]);
      setForm({ title: '', category: '', description: '', price: '', location: '', name: '' });
    }
  }

  function openJobModal(job) {
    setSelectedJob(job);
    setActiveImageIndex(0);
    setShowJobModal(true);
  }

  function openBidModal(job) {
    if (!user) { setShowAuthModal(true); setAuthMode('login'); return; }
    setSelectedJob(job);
    setBidForm({ amount: '', message: '' });
    setBidSuccess(false);
    setShowBidModal(true);
  }

  async function handleBid() {
    if (!bidForm.amount || !user) return;
    const { error: bidError } = await supabase.from('bids').insert({
      job_id: selectedJob.id,
      bidder_id: user.id,
      amount: Number(bidForm.amount),
      message: bidForm.message || '',
    });
    if (bidError) { console.error('Bid failed:', bidError); return; }
    await supabase.from('jobs').update({ bids: selectedJob.bids + 1 }).eq('id', selectedJob.id);
    const conv = { job_id: selectedJob.id, other_id: selectedJob.user_id };
    setActiveConversation(conv);
    fetchMessages(selectedJob.id);
    fetchJobs();
    setBidSuccess(true);
  }

  function openMessages(job, otherId) {
    if (!user) { setShowAuthModal(true); return; }
    const conv = { job_id: job.id, other_id: otherId };
    setActiveConversation(conv);
    setSelectedJob(job);
    fetchMessages(job.id);
    setShowMessageModal(true);
  }

  return (
    <>
      <nav>
        <div className="logo" onClick={() => { setActiveCategory('All'); window.scrollTo(0, 0); }} style={{ cursor: 'pointer' }}>JobHub</div>
        <div className="nav-right">
          {user ? (
            <>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{profile?.name || user.email}</span>
              <button className="btn-secondary" onClick={() => { fetchConversations(); setShowMessageModal(true); }}>💬 Messages</button>
              <button className="btn-secondary" onClick={handleLogout}>Log Out</button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => { setShowAuthModal(true); setAuthMode('login'); }}>Log In</button>
          )}
          <button className="btn-post" onClick={() => user ? setShowPostModal(true) : setShowAuthModal(true)}>+ Post a Job</button>
        </div>
      </nav>

      <div className="hero">
  <h1>FIND LOCAL<br /><span>CONTRACTORS</span></h1>
  <p>Post any home job, get bids from local pros, and get it done.</p>
  <button className="btn-post" onClick={() => user ? setShowPostModal(true) : setShowAuthModal(true)}>Post a Job →</button>
</div>

      <div className="filters">
  {CATEGORIES.map(cat => (
    <button key={cat} className={`filter-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
  ))}
  <button className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
    ⚙️ Filters
  </button>
</div>

{showFilters && (
  <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
    <div>
      <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Min Price ($)</label>
      <input
        type="number"
        placeholder="0"
        value={filters.minPrice}
        onChange={e => setFilters({...filters, minPrice: e.target.value})}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: '8px', width: '120px', fontFamily: 'DM Sans, sans-serif' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Max Price ($)</label>
      <input
        type="number"
        placeholder="Any"
        value={filters.maxPrice}
        onChange={e => setFilters({...filters, maxPrice: e.target.value})}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: '8px', width: '120px', fontFamily: 'DM Sans, sans-serif' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Sort By</label>
      <select
        value={filters.sortBy}
        onChange={e => setFilters({...filters, sortBy: e.target.value})}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="price_low">Price: Low to High</option>
        <option value="price_high">Price: High to Low</option>
        <option value="most_bids">Most Bids</option>
        <option value="least_bids">Least Bids</option>
      </select>
    </div>
    <button
      onClick={() => setFilters({ minPrice: '', maxPrice: '', sortBy: 'newest' })}
      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem' }}
    >
      Reset
    </button>
  </div>
)}

      <div className="jobs-grid">
        {loading ? (
          <p style={{ color: 'var(--muted)', gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>Loading jobs...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--muted)', gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>No jobs posted yet — be the first!</p>
        ) : (
          filtered.map(job => (
            <div key={job.id} className="job-card" onClick={() => openJobModal(job)}>
              <div className="job-card-img">
                {job.image_url ? (
                  <img src={job.image_url} alt={job.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (job.emoji || '📋')}
              </div>
              <div className="job-card-body">
                <div className="job-category">{job.category}</div>
                <div className="job-title">{job.title}</div>
                <div className="job-meta">📍 {job.location} · {job.bids} bids {job.poster_name && `· Posted by ${job.poster_name}`}</div>
                <div className="job-desc" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{job.description}</div>
                <div className="job-card-footer">
                  <div className="job-price">${Number(job.price).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {user && job.user_id === user.id ? (
                      <button className="bid-btn" onClick={e => { e.stopPropagation(); openMessages(job, job.user_id); }}>💬 Messages</button>
                    ) : (
                      <button className="bid-btn" onClick={e => { e.stopPropagation(); openBidModal(job); }}>Place Bid</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* JOB DETAIL MODAL */}
      {showJobModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowJobModal(false)}>
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {selectedJob.image_urls && selectedJob.image_urls.length > 0 ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <img src={selectedJob.image_urls[activeImageIndex]} alt={selectedJob.title} style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '12px' }} />
                {selectedJob.image_urls.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', overflowX: 'auto' }}>
                    {selectedJob.image_urls.map((url, i) => (
                      <img key={i} src={url} alt={`view ${i + 1}`} onClick={() => setActiveImageIndex(i)}
                        style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: i === activeImageIndex ? '2px solid var(--accent)' : '2px solid transparent', flexShrink: 0 }} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ width: '100%', height: '200px', background: 'var(--card)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', marginBottom: '1.5rem' }}>
                {selectedJob.emoji || '📋'}
              </div>
            )}
            <div className="job-category">{selectedJob.category}</div>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1.4rem', margin: '0.5rem 0' }}>{selectedJob.title}</h2>
            <div className="job-meta" style={{ marginBottom: '1rem' }}>
              📍 {selectedJob.location} · {selectedJob.bids} bids
              {selectedJob.poster_name && <span> · Posted by <strong>{selectedJob.poster_name}</strong></span>}
            </div>
            <div style={{ color: 'var(--text)', lineHeight: '1.7', marginBottom: '1.5rem' }}>{selectedJob.description}</div>
            <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>BUDGET</div>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2rem', color: 'var(--accent)' }}>${Number(selectedJob.price).toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>EXPIRES</div>
                <div style={{ fontSize: '0.9rem' }}>{new Date(selectedJob.expires_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {user && selectedJob.user_id === user.id ? (
                <button className="btn-post" style={{ flex: 1 }} onClick={() => { setShowJobModal(false); openMessages(selectedJob, selectedJob.user_id); }}>💬 View Messages</button>
              ) : (
                <button className="btn-post" style={{ flex: 1 }} onClick={() => { setShowJobModal(false); openBidModal(selectedJob); }}>Place Bid</button>
              )}
              <button className="btn-secondary" onClick={() => setShowJobModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{authMode === 'login' ? 'Log In' : 'Sign Up'}</h2>
            {authMode === 'signup' && (
              <div className="form-group">
                <label>Name <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. John Smith" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            </div>
            {authError && <p style={{ color: authError.includes('Check') ? 'var(--accent)' : '#ff6b6b', fontSize: '0.85rem', marginBottom: '1rem' }}>{authError}</p>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAuthModal(false)}>Cancel</button>
              <button className="btn-post" onClick={handleAuth} disabled={authLoading}>
                {authLoading ? 'Loading...' : authMode === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            </div>
            <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
                {authMode === 'login' ? 'Sign Up' : 'Log In'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* POST A JOB MODAL */}
      {showPostModal && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Post a Job</h2>
            <div className="form-group">
              <label>Job Title</label>
              <input placeholder="e.g. Broken gutter needs repair" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="">Select a category</option>
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea placeholder="Describe what needs to be done..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Photos</label>
              {imagePreviews.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} alt={`preview ${i}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff6b6b', border: 'none', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label className="upload-area" style={{ display: 'block', cursor: 'pointer' }}>
                📷<p>Click to add photos (multiple allowed)</p>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageChange} />
              </label>
            </div>
            <div className="form-group">
              <label>Your Budget ($)</label>
              <input type="number" placeholder="e.g. 500" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input placeholder="e.g. Salt Lake City, UT" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
            </div>
            <div className="form-group">
  <label>Your Name <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
  <input type="text" placeholder="e.g. John Smith" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPostModal(false)}>Cancel</button>
              <button className="btn-post" onClick={handlePost} disabled={posting} style={{ opacity: posting ? 0.7 : 1, cursor: posting ? 'not-allowed' : 'pointer' }}>
  {posting ? '⏳ Processing...' : 'Post Job'}
</button>
            </div>
          </div>
        </div>
      )}

      {/* BID MODAL */}
      {showBidModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowBidModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {bidSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h2>Bid Placed!</h2>
                <p style={{ color: 'var(--muted)', margin: '1rem 0 2rem' }}>
                  Your bid of <strong style={{ color: 'var(--accent)' }}>${Number(bidForm.amount).toLocaleString()}</strong> has been submitted for <strong>{selectedJob.title}</strong>.
                </p>
                <button className="btn-post" style={{ width: '100%', marginBottom: '0.75rem' }} onClick={() => { setShowBidModal(false); openMessages(selectedJob, selectedJob.user_id); }}>
                  💬 Message Homeowner
                </button>
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowBidModal(false)}>Done</button>
              </div>
            ) : (
              <>
                <h2>Place a Bid</h2>
                <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
                  <div className="job-category">{selectedJob.category}</div>
                  <div className="job-title">{selectedJob.title}</div>
                  <div className="job-meta">📍 {selectedJob.location}</div>
                  <div style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem' }}>
                    Homeowner's budget: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>${Number(selectedJob.price).toLocaleString()}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Your Bid Amount ($)</label>
                  <input type="number" placeholder="e.g. 120" value={bidForm.amount} onChange={e => setBidForm({...bidForm, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Message to Homeowner</label>
                  <textarea placeholder="Introduce yourself and explain why you're the right person for this job..." value={bidForm.message} onChange={e => setBidForm({...bidForm, message: e.target.value})} />
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowBidModal(false)}>Cancel</button>
                  <button className="btn-post" onClick={handleBid}>Submit Bid</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h2>💬 Messages</h2>
            {!activeConversation ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {conversations.length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No messages yet. Place a bid to start a conversation!</p>
                ) : (
                  conversations.map((conv, i) => {
                    const job = jobs.find(j => j.id === conv.job_id);
                    return (
                      <div key={i} onClick={() => { setActiveConversation({ job_id: conv.job_id, other_id: conv.sender_id === user.id ? conv.receiver_id : conv.sender_id }); fetchMessages(conv.job_id); }}
                        style={{ padding: '1rem', borderRadius: '10px', background: 'var(--card)', marginBottom: '0.75rem', cursor: 'pointer', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600 }}>{job?.title || 'Job'}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Tap to view conversation</div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                <button onClick={() => setActiveConversation(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textAlign: 'left', marginBottom: '1rem', fontSize: '0.85rem' }}>← Back to conversations</button>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {messages.length === 0 ? (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No messages yet — say hello!</p>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} style={{
                        alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
                        background: msg.sender_id === user.id ? 'var(--accent)' : 'var(--card)',
                        color: msg.sender_id === user.id ? '#fff' : 'var(--text)',
                        padding: '0.6rem 1rem',
                        borderRadius: '12px',
                        maxWidth: '75%',
                        fontSize: '0.9rem',
                      }}>
                        {msg.content}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.75rem', borderRadius: '10px', fontFamily: 'DM Sans, sans-serif' }}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  />
                  <button className="btn-post" onClick={sendMessage}>Send</button>
                </div>
              </>
            )}
            <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setShowMessageModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}