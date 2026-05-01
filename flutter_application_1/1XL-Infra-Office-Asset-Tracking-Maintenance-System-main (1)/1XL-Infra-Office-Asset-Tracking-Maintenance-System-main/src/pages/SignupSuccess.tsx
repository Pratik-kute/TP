import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Box, CheckCircle2, Mail, Sun, Moon } from 'lucide-react';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import './Landing.css';

export default function SignupSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const orgName = searchParams.get('org') || 'your organization';
  const shortName = searchParams.get('shortName') || '';
  const email = searchParams.get('email') || '';

  // Gentle auto-redirect to the login page after 12 seconds so users who
  // walk away still land somewhere useful when they come back.
  useEffect(() => {
    const t = window.setTimeout(() => navigate('/login'), 12000);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <motion.div
      className={`landing-root ${!isDark ? 'light' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div className="auth-top-bar">
        <div className="nav-logo">
          <div className="nav-logo-icon"><Box size={20} /></div>
          Asset Tracker
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-shell auth-shell-center">
        <div className="auth-shell-bg" />
        <div className="auth-shell-grid" />
        <div className="auth-shell-shapes">
          <ElegantShape delay={0.15} width={520} height={130} rotate={12} gradient="rgba(16, 185, 129, 0.12)" className="shape-1" />
          <ElegantShape delay={0.35} width={420} height={100} rotate={-15} gradient="rgba(139, 92, 246, 0.12)" className="shape-2" />
        </div>

        <motion.div
          className="signup-success-card"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="signup-success-icon">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="signup-success-title">You're all set!</h1>
          <p className="signup-success-text">
            <strong style={{ color: 'var(--text-primary)' }}>{orgName}</strong> has been created.
            We've sent your login details to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>

          <div className="signup-success-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Mail size={16} color="var(--accent-purple-light)" />
              <strong>Check your inbox</strong>
            </div>
            <div>
              Your welcome email contains your admin credentials and a direct link to sign in.
              {shortName && <> Your workspace URL is <strong>/{shortName}</strong>.</>}
            </div>
          </div>

          <button
            className="auth-submit-btn"
            onClick={() => navigate('/login')}
          >
            Go to Sign In <ArrowRight size={18} style={{ marginLeft: 6 }} />
          </button>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
            You'll be redirected automatically in a few seconds.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
