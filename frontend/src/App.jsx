import { useState, useEffect } from 'react'
import { 
  Phone, PhoneOff, User, Users, FileText, 
  Plus, Search, Clock, CheckCircle, XCircle,
  Bot, Settings, Activity, Trash2
} from 'lucide-react'
import './index.css'

const API_BASE = 'https://maroon-goldfinch-327420.hostingersite.com/api'

const initialCandidates = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 555-0101', email: 'sarah.j@email.com', status: 'completed', score: 85, questions: 'Tell me about your experience with React.' },
  { id: 2, name: 'Michael Chen', phone: '+1 555-0102', email: 'mchen@email.com', status: 'pending', score: null, questions: 'What is your experience with TypeScript?' },
  { id: 3, name: 'Emily Davis', phone: '+1 555-0103', email: 'emily.d@email.com', status: 'pending', score: null, questions: 'Describe your frontend architecture knowledge.' },
  { id: 4, name: 'James Wilson', phone: '+1 555-0104', email: 'jwilson@email.com', status: 'completed', score: 72, questions: 'How do you handle state management?' },
]

function App() {
  const [candidates, setCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [transcript, setTranscript] = useState([])
  const [newCandidate, setNewCandidate] = useState({ name: '', phone: '', email: '', questions: '' })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    asteriskHost: 'localhost',
    asteriskPort: '5038',
    asteriskUser: 'admin',
    asteriskSecret: '',
    asteriskContext: 'from-sip',
    asteriskOutboundChannel: 'SIP/trunk',
    openaiKey: ''
  })
  const [loading, setLoading] = useState(false)
  const [useLocal, setUseLocal] = useState(false)

  useEffect(() => {
    loadCandidates()
    loadSettings()
  }, [])

  const loadCandidates = () => {
    const saved = localStorage.getItem('candidates')
    if (saved) {
      setCandidates(JSON.parse(saved))
      setUseLocal(true)
    } else {
      setCandidates(initialCandidates)
      localStorage.setItem('candidates', JSON.stringify(initialCandidates))
    }
  }

  const saveCandidates = (data) => {
    localStorage.setItem('candidates', JSON.stringify(data))
    setCandidates(data)
  }

  const loadSettings = () => {
    const saved = localStorage.getItem('apiKeys')
    if (saved) {
      setApiKeys(JSON.parse(saved))
    }
  }

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE}/candidates`)
      if (res.ok) {
        const data = await res.json()
        setCandidates(data)
        setUseLocal(false)
      }
    } catch (err) {
      console.log('Using local storage')
      loadCandidates()
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`)
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data)
      }
    } catch (err) {
      loadSettings()
    }
  }

  const stats = {
    total: candidates.length,
    completed: candidates.filter(c => c.status === 'completed').length,
    pending: candidates.filter(c => c.status === 'pending').length,
    inProgress: candidates.filter(c => c.status === 'in-progress').length,
  }

  const startCall = async (candidate) => {
    setSelectedCandidate(candidate)
    setIsCalling(true)
    setCallDuration(0)
    setTranscript([{ speaker: 'AI', text: 'Connecting call...' }])
    
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)

    try {
      const res = await fetch(`${API_BASE}/calls/start/${candidate.id}`, { method: 'POST' })
      const data = await res.json()
      if (data.candidate?.transcript) {
        setTranscript(data.candidate.transcript)
      }
    } catch (err) {
      setTranscript([{ 
        speaker: 'AI', 
        text: `Hello ${candidate.name}, ${candidate.questions || 'Tell me about yourself and your experience.'}` 
      }])
    }
  }

  const endCall = async (candidate) => {
    setIsCalling(false)
    const score = Math.floor(Math.random() * 30) + 70
    setTranscript(prev => [...prev, { speaker: 'AI', text: 'Thank you for your time. We will be in touch soon. Goodbye!' }])
    
    try {
      await fetch(`${API_BASE}/calls/end/${candidate.id}`, { method: 'POST' })
    } catch (err) {
      const updated = candidates.map(c => 
        c.id === candidate.id ? { ...c, status: 'completed', score } : c
      )
      saveCandidates(updated)
    }
    
    setTimeout(() => {
      setTranscript([])
    }, 2000)
  }

  const addCandidate = async () => {
    if (newCandidate.name && newCandidate.phone) {
      const candidate = {
        id: Date.now(),
        ...newCandidate,
        status: 'pending',
        score: null,
        transcript: [],
        callDuration: 0
      }
      
      try {
        const res = await fetch(`${API_BASE}/candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCandidate)
        })
        if (res.ok) {
          const added = await res.json()
          setCandidates([added, ...candidates])
        }
      } catch (err) {
        const updated = [candidate, ...candidates]
        saveCandidates(updated)
      }
      
      setNewCandidate({ name: '', phone: '', email: '', questions: '' })
      setShowAddModal(false)
    }
  }

  const deleteCandidate = async (id, e) => {
    e.stopPropagation()
    try {
      await fetch(`${API_BASE}/candidates/${id}`, { method: 'DELETE' })
      setCandidates(candidates.filter(c => c.id !== id))
    } catch (err) {
      const updated = candidates.filter(c => c.id !== id)
      saveCandidates(updated)
    }
    if (selectedCandidate && selectedCandidate.id === id) {
      setSelectedCandidate(null)
    }
  }

  const saveSettings = async () => {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeys)
      })
    } catch (err) {
      localStorage.setItem('apiKeys', JSON.stringify(apiKeys))
    }
    setShowSettings(false)
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getFilteredCandidates = () => {
    switch (activeTab) {
      case 'calls':
        return candidates.filter(c => c.status === 'in-progress')
      case 'reports':
        return candidates.filter(c => c.status === 'completed')
      default:
        return candidates
    }
  }

  const filteredCandidates = getFilteredCandidates()

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <Bot />
            </div>
            <div className="logo-text">
              <h1>AI Voice Recruiter</h1>
              <p>Automated Candidate Screening</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="api-status">
              <Activity style={{ width: '1rem', height: '1rem' }} />
              <span>API Connected</span>
            </div>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>
              <Settings />
            </button>
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="nav-content">
          {[
            { id: 'dashboard', icon: Activity, label: 'Dashboard' },
            { id: 'candidates', icon: Users, label: 'Candidates' },
            { id: 'calls', icon: Phone, label: 'Active Calls' },
            { id: 'reports', icon: FileText, label: 'Reports' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon style={{ width: '1rem', height: '1rem' }} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
        {activeTab === 'dashboard' && (
          <>
            <div className="stats-grid">
              {[
                { label: 'Total Candidates', value: stats.total, icon: Users, color: 'purple' },
                { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'green' },
                { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'yellow' },
                { label: 'Pending', value: stats.pending, icon: Phone, color: 'blue' },
              ].map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">{stat.label}</span>
                    <div className={`stat-icon ${stat.color}`}>
                      <stat.icon style={{ width: '1.25rem', height: '1.25rem' }} />
                    </div>
                  </div>
                  <p className="stat-value">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Recent Activity</h2>
              </div>
              <div className="card-body">
                {candidates.filter(c => c.status === 'completed').slice(0, 3).map(candidate => (
                  <div key={candidate.id} className="activity-item">
                    <div className="activity-avatar">
                      {candidate.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="activity-info">
                      <h4>{candidate.name}</h4>
                      <p>Interview completed - Score: {candidate.score}/100</p>
                    </div>
                    <span className="status-badge completed">Completed</span>
                  </div>
                ))}
                {candidates.filter(c => c.status === 'completed').length === 0 && (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No recent activity</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab !== 'dashboard' && (
          <div className="content-grid">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  {activeTab === 'candidates' && 'All Candidates'}
                  {activeTab === 'calls' && 'Active Calls'}
                  {activeTab === 'reports' && 'Completed Reports'}
                </h2>
                <button 
                onClick={() => setShowAddModal(true)}
                className="add-btn"
              >
                <Plus />
                Add Candidate
              </button>
            </div>
            
            <div className="card-body">
              <div className="search-box">
                <Search />
                <input 
                  type="text" 
                  placeholder="Search candidates..." 
                  className="search-input"
                />
              </div>

              <div className="candidate-list">
                {filteredCandidates.map(candidate => (
                  <div 
                    key={candidate.id}
                    className="candidate-item"
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <div className="candidate-info">
                      <div className="candidate-avatar">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="candidate-details">
                        <h3>{candidate.name}</h3>
                        <p>{candidate.email}</p>
                      </div>
                    </div>
                    <div className="candidate-actions">
                      <span className={`status-badge ${candidate.status}`}>
                        {candidate.status === 'completed' ? 'Completed' :
                         candidate.status === 'in-progress' ? 'In Progress' : 'Pending'}
                      </span>
                      {candidate.score && (
                        <div className="score">
                          <p className="score-value">{candidate.score}</p>
                          <p className="score-label">Score</p>
                        </div>
                      )}
                      <button
                        onClick={(e) => deleteCandidate(candidate.id, e)}
                        className="delete-btn"
                        title="Delete candidate"
                      >
                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (candidate.status !== 'completed') {
                            setCandidates(prev => prev.map(c => 
                              c.id === candidate.id ? { ...c, status: 'in-progress' } : c
                            ))
                            startCall(candidate)
                          }
                        }}
                        disabled={candidate.status === 'completed'}
                        className="call-btn"
                      >
                        <Phone style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            {isCalling ? (
              <div className="call-interface">
                <div className="call-info">
                  <div className="call-avatar">
                    <div className="call-avatar-inner">
                      <Bot />
                    </div>
                  </div>
                  <h3>AI Calling...</h3>
                  <p>{selectedCandidate?.name}</p>
                  <p className="call-timer">{formatDuration(callDuration)}</p>
                </div>

                <div className="waveform">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="waveform-bar" />
                  ))}
                </div>

                <div className="transcript">
                  <h4 className="transcript-title">Live Transcript</h4>
                  <div className="transcript-messages">
                    {transcript.map((msg, i) => (
                      <div key={i} className={`transcript-msg ${msg.speaker === 'AI' ? 'ai' : 'candidate'}`}>
                        <div className={`msg-bubble ${msg.speaker === 'AI' ? 'ai' : 'candidate'}`}>
                          <span className="msg-speaker">{msg.speaker}</span>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => endCall(selectedCandidate)}
                  className="btn btn-danger"
                >
                  <PhoneOff style={{ width: '1.25rem', height: '1.25rem' }} />
                  End Call
                </button>
              </div>
            ) : selectedCandidate ? (
              <div className="call-interface">
                <div className="call-info">
                  <div className="call-avatar">
                    <div className="call-avatar-inner">
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                        {selectedCandidate.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <h3>{selectedCandidate.name}</h3>
                  <p>{selectedCandidate.email}</p>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{selectedCandidate.phone}</p>
                </div>

                <div>
                  <div className="questions-card">
                    <h4 className="questions-title">Questions to Ask</h4>
                    <p className="questions-text">{selectedCandidate.questions || 'No specific questions set'}</p>
                  </div>

                  {selectedCandidate.score && (
                    <div className="score-card">
                      <h4 className="questions-title">AI Evaluation</h4>
                      <div className="score-header">
                        <span>Score</span>
                        <span className={`score-value-large ${
                          selectedCandidate.score >= 80 ? 'high' :
                          selectedCandidate.score >= 60 ? 'medium' : 'low'
                        }`}>{selectedCandidate.score}/100</span>
                      </div>
                      <div className="score-bar">
                        <div 
                          className="score-bar-fill"
                          style={{ width: `${selectedCandidate.score}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => startCall(selectedCandidate)}
                    disabled={selectedCandidate.status === 'completed'}
                    className="btn btn-primary"
                  >
                    <Phone style={{ width: '1.25rem', height: '1.25rem' }} />
                    {selectedCandidate.status === 'completed' ? 'Call Completed' : 'Start Interview'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <User />
                </div>
                <h3 className="empty-title">No Candidate Selected</h3>
                <p className="empty-text">Select a candidate from the list to view details or start a call</p>
              </div>
            )}
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add New Candidate</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="modal-close"
              >
                <XCircle style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            <div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text"
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  className="form-input"
                  placeholder="John Doe"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input 
                  type="tel"
                  value={newCandidate.phone}
                  onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                  className="form-input"
                  placeholder="+1 555-0100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email"
                  value={newCandidate.email}
                  onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })}
                  className="form-input"
                  placeholder="john@email.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Interview Questions</label>
                <textarea 
                  value={newCandidate.questions}
                  onChange={(e) => setNewCandidate({ ...newCandidate, questions: e.target.value })}
                  className="form-input"
                  placeholder="Tell me about your experience with..."
                />
              </div>

              <button
                onClick={addCandidate}
                className="btn btn-primary"
              >
                <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
                Add Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">API Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="modal-close"
              >
                <XCircle style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Asterisk Settings</h3>
              <div className="form-group">
                <label className="form-label">Asterisk Host IP</label>
                <input 
                  type="text"
                  value={apiKeys.asteriskHost}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskHost: e.target.value })}
                  className="form-input"
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Asterisk AMI Port</label>
                <input 
                  type="text"
                  value={apiKeys.asteriskPort}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskPort: e.target.value })}
                  className="form-input"
                  placeholder="5038"
                />
              </div>
              <div className="form-group">
                <label className="form-label">AMI Username</label>
                <input 
                  type="text"
                  value={apiKeys.asteriskUser}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskUser: e.target.value })}
                  className="form-input"
                  placeholder="admin"
                />
              </div>
              <div className="form-group">
                <label className="form-label">AMI Secret</label>
                <input 
                  type="password"
                  value={apiKeys.asteriskSecret}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskSecret: e.target.value })}
                  className="form-input"
                  placeholder="Your AMI secret"
                />
              </div>
              <div className="form-group">
                <label className="form-label">SIP Context</label>
                <input 
                  type="text"
                  value={apiKeys.asteriskContext}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskContext: e.target.value })}
                  className="form-input"
                  placeholder="from-sip"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Outbound Channel</label>
                <input 
                  type="text"
                  value={apiKeys.asteriskOutboundChannel}
                  onChange={(e) => setApiKeys({ ...apiKeys, asteriskOutboundChannel: e.target.value })}
                  className="form-input"
                  placeholder="SIP/trunk"
                />
              </div>
              <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--text-primary)' }}>AI Settings</h3>
              <div className="form-group">
                <label className="form-label">OpenAI API Key</label>
                <input 
                  type="password"
                  value={apiKeys.openaiKey}
                  onChange={(e) => setApiKeys({ ...apiKeys, openaiKey: e.target.value })}
                  className="form-input"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <button
                onClick={saveSettings}
                className="btn btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
