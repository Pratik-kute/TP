import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Box, Sun, Moon, Mail, CheckCircle2 } from 'lucide-react';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import { requestPasswordReset } from '../lib/passwordReset';
import './Landing.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setError(result.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      setSubmitted(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.div
      className={`landing-root ${!isDark ? 'light' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div className="auth-top-bar">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <Box size={20} />
          </div>
          Asset Tracker
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="auth-top-bar-link" onClick={() => navigate('/login')}>
            <ArrowLeft size={16} /> Back to login
          </button>
        </div>
      </div>

      <div className="auth-shell auth-shell-center">
        <div className="auth-shell-bg" />
        <div className="auth-shell-grid" />
        <div className="auth-shell-shapes">
          <ElegantShape delay={0.2} width={520} height={120} rotate={12} gradient="rgba(139, 92, 246, 0.15)" className="shape-1" />
          <ElegantShape delay={0.35} width={420} height={100} rotate={-15} gradient="rgba(244, 63, 94, 0.1)" className="shape-2" />
          <ElegantShape delay={0.5} width={260} height={70} rotate={-8} gradient="rgba(6, 182, 212, 0.12)" className="shape-4" />
        </div>

        <div className="auth-content" style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
          >
            {!submitted ? (
              <>
                <h2 className="auth-card-title">Forgot password?</h2>
                <p className="auth-card-sub">
                  Enter the email address tied to your account and we'll send you a secure link to reset your password.
                </p>

                {error && (
                  <div className="auth-error" style={{ marginBottom: 18 }}>
                    <span className="auth-error-dot" />
                    {error}
                  </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                  <div>
                    <label className="auth-label">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="auth-input"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="auth-submit-btn"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-sm" />
                        Sending link...
                      </>
                    ) : (
                      <>Send reset link <ArrowRight size={18} style={{ marginLeft: 6 }} /></>
                    )}
                  </button>
                </form>

                <div className="auth-footnote">
                  Remembered it?{' '}
                  <button type="button" className="auth-link" onClick={() => navigate('/login')}>
                    Back to login
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 18px',
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle2 size={28} color="#10b981" />
                </div>
                <h2 className="auth-card-title" style={{ textAlign: 'center' }}>Check your inbox</h2>
                <p className="auth-card-sub" style={{ textAlign: 'center' }}>
                  If <strong>{email}</strong> belongs to an account, we've sent a reset link to it. The link is valid for one hour.
                </p>
                <div style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--text-secondary, #9ca3af)',
                }}>
                  <Mail size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Didn't get the email? Check your spam folder, or wait a minute and try again with the same address.
                  </span>
                </div>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ marginTop: 22 }}
                  onClick={() => navigate('/login')}
                >
                  Back to login
                </button>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
