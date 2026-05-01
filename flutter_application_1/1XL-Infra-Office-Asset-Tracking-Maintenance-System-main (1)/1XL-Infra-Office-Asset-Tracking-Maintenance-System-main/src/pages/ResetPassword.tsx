import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Box, Sun, Moon, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import { validateResetToken, resetPassword } from '../lib/passwordReset';
import './Landing.css';

type Phase = 'checking' | 'invalid' | 'ready' | 'success';

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [phase, setPhase] = useState<Phase>('checking');
  const [tokenError, setTokenError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate token on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await validateResetToken(token || '');
      if (cancelled) return;
      if (!result.valid) {
        setTokenError(result.error || 'This reset link is invalid or has expired.');
        setPhase('invalid');
        return;
      }
      if (result.userEmail) {
        // Mask local part for the success screen: jo***@example.com
        const [local, domain] = result.userEmail.split('@');
        const masked = local.length <= 2
          ? local[0] + '***'
          : local.slice(0, 2) + '***';
        setMaskedEmail(domain ? `${masked}@${domain}` : masked);
      }
      setPhase('ready');
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await resetPassword(token || '', password);
    if (!result.ok) {
      setError(result.error || 'Failed to reset password.');
      setSubmitting(false);
      return;
    }
    setPhase('success');
    setSubmitting(false);
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
            {phase === 'checking' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
                <span className="spinner-sm" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <p className="auth-card-sub" style={{ marginTop: 18 }}>Verifying your reset link…</p>
              </div>
            )}

            {phase === 'invalid' && (
              <>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 18px',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle size={28} color="#f43f5e" />
                </div>
                <h2 className="auth-card-title" style={{ textAlign: 'center' }}>Link no longer valid</h2>
                <p className="auth-card-sub" style={{ textAlign: 'center' }}>{tokenError}</p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ marginTop: 22 }}
                  onClick={() => navigate('/forgot-password')}
                >
                  Request a new link <ArrowRight size={18} style={{ marginLeft: 6 }} />
                </button>
                <div className="auth-footnote">
                  <button type="button" className="auth-link" onClick={() => navigate('/login')}>
                    Back to login
                  </button>
                </div>
              </>
            )}

            {phase === 'ready' && (
              <>
                <h2 className="auth-card-title">Set a new password</h2>
                <p className="auth-card-sub">
                  {maskedEmail
                    ? <>Resetting the password for <strong>{maskedEmail}</strong>.</>
                    : 'Choose a new password for your account.'}
                </p>

                {error && (
                  <div className="auth-error" style={{ marginBottom: 18 }}>
                    <span className="auth-error-dot" />
                    {error}
                  </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                  <div>
                    <label className="auth-label">New password</label>
                    <div className="auth-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="auth-input"
                        required
                        minLength={8}
                        disabled={submitting}
                        autoFocus
                        style={{ paddingRight: 46 }}
                      />
                      <button
                        type="button"
                        className="auth-input-icon-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="auth-label">Confirm new password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat the new password"
                      className="auth-input"
                      required
                      minLength={8}
                      disabled={submitting}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !password || !confirmPassword}
                    className="auth-submit-btn"
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-sm" />
                        Updating password...
                      </>
                    ) : (
                      <>Update password <ArrowRight size={18} style={{ marginLeft: 6 }} /></>
                    )}
                  </button>
                </form>
              </>
            )}

            {phase === 'success' && (
              <>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 18px',
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle2 size={28} color="#10b981" />
                </div>
                <h2 className="auth-card-title" style={{ textAlign: 'center' }}>Password updated</h2>
                <p className="auth-card-sub" style={{ textAlign: 'center' }}>
                  You're all set. Sign in with your new password to continue.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ marginTop: 22 }}
                  onClick={() => navigate('/login')}
                >
                  Go to login <ArrowRight size={18} style={{ marginLeft: 6 }} />
                </button>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
