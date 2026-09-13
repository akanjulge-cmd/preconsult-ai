import React, { useState, useEffect } from 'react';
import { getPatientIntakes, getPatientDocuments, updateProfile } from '../../services/api';

export default function PatientDashboard({
  user,
  onStartIntake,
  onOpenScanner,
  onUpdateUser,
}) {
  const [activeTab, setActiveTab] = useState('intakes'); // 'intakes' | 'documents' | 'profile'
  const [intakes, setIntakes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [preferredLang, setPreferredLang] = useState(user?.profile?.preferred_language || 'en');
  const [accessMode, setAccessMode] = useState(user?.profile?.accessibility_mode || 'standard');
  const [emergencyContact, setEmergencyContact] = useState(user?.profile?.emergency_contact || '');
  const [allergies, setAllergies] = useState(user?.profile?.allergies || '');
  const [medications, setMedications] = useState(user?.profile?.current_medications || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [intakesData, docsData] = await Promise.all([
          getPatientIntakes().catch(() => []),
          getPatientDocuments().catch(() => []),
        ]);
        setIntakes(intakesData);
        setDocuments(docsData);
      } catch (err) {
        setError(err.message || 'Failed to load patient records');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  async function handleProfileSubmit(e) {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg(null);
    setError(null);
    try {
      const res = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        preferred_language: preferredLang,
        accessibility_mode: accessMode,
        emergency_contact: emergencyContact.trim(),
        allergies: allergies.trim(),
        current_medications: medications.trim(),
      });
      setSavingProfile(false);
      setProfileSuccessMsg(res.message || 'Profile saved successfully.');
      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          name: fullName.trim(),
          profile: {
            ...user?.profile,
            phone: phone.trim(),
            preferred_language: preferredLang,
            accessibility_mode: accessMode,
            emergency_contact: emergencyContact.trim(),
            allergies: allergies.trim(),
            current_medications: medications.trim(),
          },
        });
      }
    } catch (err) {
      setSavingProfile(false);
      setError(err.message || 'Failed to save profile changes.');
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      {/* Welcome Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
          borderRadius: '16px',
          padding: '1.75rem',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.25)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            PATIENT PORTAL
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.4rem 0' }}>
            Welcome, {user?.name || 'Patient'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
            Review past pre-consultation briefs, track intake status, and manage your health preferences.
          </p>
        </div>

        <button
          onClick={onStartIntake}
          style={{
            background: '#ffffff',
            color: '#0284c7',
            fontWeight: 800,
            fontSize: '0.95rem',
            padding: '0.75rem 1.4rem',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'transform 0.1s ease',
          }}
        >
          🚀 Start New Clinical Intake
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('intakes')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'intakes' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'intakes' ? '#0284c7' : '#64748b',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
          }}
        >
          📥 Intake Records ({intakes.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'documents' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'documents' ? '#0284c7' : '#64748b',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
          }}
        >
          📄 Scanned Prescriptions & Labs ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'profile' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'profile' ? '#0284c7' : '#64748b',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
          }}
        >
          👤 Profile & Accessibility Preferences
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '1rem', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      {profileSuccessMsg && (
        <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', marginBottom: '1rem', fontWeight: 700 }}>
          ✓ {profileSuccessMsg}
        </div>
      )}

      {/* TAB 1: INTAKE RECORDS */}
      {activeTab === 'intakes' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Loading your clinical intake records...
            </div>
          ) : intakes.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '3rem 1.5rem',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '2.5rem' }}>📭</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0.75rem 0 0.25rem 0' }}>
                No Intakes Submitted Yet
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.25rem auto' }}>
                Start a clinical intake session to record your symptoms on the 3D anatomical body map.
              </p>
              <button
                onClick={onStartIntake}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + Launch Pre-Consultation Intake
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {intakes.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>📍</span>
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                        {item.selected_body_region} {item.anatomical_zone ? `(${item.anatomical_zone})` : ''}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: item.triage_urgency === 'EMERGENCY' ? '#fee2e2' : item.triage_urgency === 'URGENT' ? '#fef3c7' : '#f0fdf4',
                          color: item.triage_urgency === 'EMERGENCY' ? '#dc2626' : item.triage_urgency === 'URGENT' ? '#d97706' : '#15803d',
                        }}
                      >
                        {item.triage_urgency || 'ROUTINE'}
                      </span>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: item.is_approved ? '#dcfce7' : '#f1f5f9',
                          color: item.is_approved ? '#15803d' : '#475569',
                        }}
                      >
                        {item.is_approved ? '✓ Doctor Approved' : item.clinician_review_status || 'Submitted'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Character</span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>{item.symptom_character || item.symptom || 'Unspecified'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Severity</span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>{item.severity ? `${item.severity} / 10` : 'Not rated'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Session ID</span>
                      <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#64748b' }}>{item.session_id}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Submitted</span>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent'}
                      </div>
                    </div>
                  </div>

                  {item.voice_transcript && (
                    <div style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic', background: '#ffffff', padding: '0.5rem', borderLeft: '3px solid #0284c7' }}>
                      "{item.voice_transcript}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCANNED DOCUMENTS */}
      {activeTab === 'documents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Your Uploaded Prescriptions & Lab Records
            </h3>
            <button
              onClick={onOpenScanner}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                background: '#0d9488',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              📷 Upload New Scan
            </button>
          </div>

          {documents.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '2rem' }}>📄</span>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0 1rem 0' }}>
                No documents uploaded yet. You can upload prescription photos or lab PDFs.
              </p>
              <button
                onClick={onOpenScanner}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Scan Prescription / Lab
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Type: {doc.document_type} &bull; {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recent'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: doc.confidence_score >= 0.85 ? '#15803d' : '#d97706' }}>
                      OCR Confidence: {Math.round((doc.confidence_score || 0.9) * 100)}%
                    </span>
                    <span style={{ fontSize: '0.75rem', background: doc.is_verified ? '#dcfce7' : '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 800 }}>
                      {doc.is_verified ? 'Verified' : 'Pending Review'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE & ACCESSIBILITY PREFERENCES */}
      {activeTab === 'profile' && (
        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0' }}>
            Personal Profile & Accessibility Configuration
          </h3>

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Preferred Language
                </label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                >
                  <option value="en">English (US)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Accessibility Interaction Mode
                </label>
                <select
                  value={accessMode}
                  onChange={(e) => setAccessMode(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                >
                  <option value="standard">Standard Touch & Keyboard</option>
                  <option value="non_speaking">Non-Speaking (AAC Touch Only)</option>
                  <option value="tremor">Motor / Tremor Assistance (68px Targets)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Known Allergies
                </label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa, Latex"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name and phone number"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Current Active Medications
              </label>
              <textarea
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                rows={2}
                placeholder="e.g. Omeprazole 20mg daily, Metformin 500mg twice daily"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              style={{
                alignSelf: 'flex-start',
                padding: '0.7rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: savingProfile ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)',
              }}
            >
              {savingProfile ? 'Saving Changes...' : '✓ Save Profile Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
