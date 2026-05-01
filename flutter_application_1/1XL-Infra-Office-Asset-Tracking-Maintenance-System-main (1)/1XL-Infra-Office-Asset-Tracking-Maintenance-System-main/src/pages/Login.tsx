import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  Eye, EyeOff, ArrowRight, Shield, BarChart3, Users, Wrench, ArrowLeft, Box, Sun, Moon,
} from 'lucide-react';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import './Landing.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, organizations } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(username, password);
      if (loggedInUser) {
        if (loggedInUser.isGlobalAdmin) {
          navigate('/select-org');
        } else {
          const userOrg = organizations.find(o => o.id === loggedInUser.organizationId);
          navigate(`/${userOrg?.shortName || 'ORG'}/dashboard`);
        }
      } else {
        setError('Invalid username or password');
        setLoading(false);
      }
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
      {/* Top bar (fixed) — back to home link */}
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
          <button className="auth-top-bar-link" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to home
          </button>
        </div>
      </div>

      {/* Full-viewport dark shell */}
      <div className="auth-shell auth-shell-center">
        <div className="auth-shell-bg" />
        <div className="auth-shell-grid" />
        <div className="auth-shell-shapes">
          <ElegantShape delay={0.2} width={520} height={120} rotate={12} gradient="rgba(139, 92, 246, 0.15)" className="shape-1" />
          <ElegantShape delay={0.35} width={420} height={100} rotate={-15} gradient="rgba(244, 63, 94, 0.1)" className="shape-2" />
          <ElegantShape delay={0.5} width={260} height={70} rotate={-8} gradient="rgba(6, 182, 212, 0.12)" className="shape-4" />
        </div>

        <div className="auth-content">
          {/* Left — brand panel */}
          <motion.div
            className="auth-brand"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <div className="auth-brand-badge">
              <span className="auth-brand-badge-dot" />
              Welcome back
            </div>
            <h1 className="auth-brand-title">
              Sign in to<br />your asset<br />command center
            </h1>
            <p className="auth-brand-sub">
              Real-time tracking, automated maintenance, and comprehensive reporting -
              all in one place.
            </p>
            <div className="auth-brand-features">
              {[
                { icon: Shield, label: 'Role-Based Access', desc: 'Secure permissions' },
                { icon: BarChart3, label: 'Analytics & Reports', desc: 'Data-driven insights' },
                { icon: Users, label: 'Team Management', desc: 'Collaborative workflow' },
                { icon: Wrench, label: 'Maintenance Ops', desc: 'Preventive scheduling' },
              ].map(s => (
                <div key={s.label} className="auth-brand-feature">
                  <div className="auth-brand-feature-icon">
                    <s.icon size={18} />
                  </div>
                  <div>
                    <div className="auth-brand-feature-label">{s.label}</div>
                    <div className="auth-brand-feature-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — login card */}
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-sub">Sign in to your account to continue</p>

            {error && (
              <div className="auth-error" style={{ marginBottom: 18 }}>
                <span className="auth-error-dot" />
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div>
                <label className="auth-label">Email or Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="you@company.com"
                  className="auth-input"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="auth-label">Password</label>
                  <button
                    type="button"
                    className="auth-link"
                    style={{ fontSize: 12 }}
                    onClick={() => navigate('/forgot-password')}
                    tabIndex={-1}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="auth-input"
                    required
                    disabled={loading}
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

              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner-sm" />
                    Signing in...
                  </>
                ) : (
                  <>Sign In <ArrowRight size={18} style={{ marginLeft: 6 }} /></>
                )}
              </button>
            </form>

            <div className="auth-footnote">
              Don't have an account?{' '}
              <button type="button" className="auth-link" onClick={() => navigate('/signup')}>
                Get started
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
