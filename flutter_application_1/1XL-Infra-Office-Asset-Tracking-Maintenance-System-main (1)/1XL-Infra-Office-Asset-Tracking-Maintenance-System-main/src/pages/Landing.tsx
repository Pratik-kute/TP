import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box, Wrench, ClipboardList, Package,
  ArrowRight, CheckCircle2, Star, Menu, X, Zap,
  Monitor, Users, Bell,
  LayoutDashboard, AlertTriangle, RefreshCw,
  Settings, DollarSign, Sun, Moon,
  Building2, Briefcase, ShieldCheck, BarChart3, Plug,
  HelpCircle, Plus, QrCode, FileSpreadsheet, Mail,
  Globe, Code2, Lock, Award, TrendingUp, Smartphone,
  Factory, GraduationCap, Hospital, MapPin, Activity,
  FileText, Database, Webhook, XCircle,
} from 'lucide-react';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import './Landing.css';

/* ===== HOLOGRAPHIC CARD (used only here on Landing) ===== */
function HoloCard({ children, className }: { children: ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 15;
    const rotateY = (centerX - x) / 15;

    card.style.setProperty('--holo-x', `${x}px`);
    card.style.setProperty('--holo-y', `${y}px`);
    card.style.setProperty('--bg-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--bg-y', `${(y / rect.height) * 100}%`);
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    card.style.setProperty('--holo-x', '50%');
    card.style.setProperty('--holo-y', '50%');
    card.style.setProperty('--bg-x', '50%');
    card.style.setProperty('--bg-y', '50%');
  };

  return (
    <div
      ref={cardRef}
      className={`feature-card holo-card ${className || ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div className="holo-glow" />
    </div>
  );
}

/* ===== CUSTOM SVG ICONS ===== */
const FeatureIcons = {
  assetMgmt: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <circle cx="12" cy="14" r="3" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  ),
  allocations: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <path d="M9 13c-4 0-6 2-6 4v1h12v-1c0-2-2-4-6-4Z" />
      <path d="M17 11l2 2 4-4" />
      <circle cx="19" cy="7" r="2.5" strokeDasharray="3 2" />
    </svg>
  ),
  maintenance: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
      <path d="M20 4l1.5 1.5" />
      <path d="M4 20l-1.5-1.5" />
      <path d="M3.5 7L2 6.5" />
    </svg>
  ),
  repairs: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  ),
  consumables: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  recovery: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
};

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goToLogin = () => navigate('/login');
  const goToSignup = (plan?: 'beginner' | 'pro' | 'premium') =>
    navigate(plan ? `/signup?plan=${plan}` : '/signup');

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenuOpen(false);
  };

  return (
    <div className={`landing-root ${!isDark ? 'light' : ''}`}>
      {/* NAVBAR */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <Box size={20} />
          </div>
          Asset Tracker
        </div>
        <ul className="nav-links">
          <li><a href="#features" onClick={scrollToSection('features')}>Features</a></li>
          <li><a href="#solutions" onClick={scrollToSection('solutions')}>Solutions</a></li>
          <li><a href="#integrations" onClick={scrollToSection('integrations')}>Integrations</a></li>
          <li><a href="#dashboard" onClick={scrollToSection('dashboard')}>Dashboard</a></li>
          <li><a href="#pricing" onClick={scrollToSection('pricing')}>Pricing</a></li>
          <li><a href="#faq" onClick={scrollToSection('faq')}>FAQ</a></li>
        </ul>
        <div className="nav-cta">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn-secondary" onClick={goToLogin}>Sign In</button>
          <button className="btn-primary" onClick={() => goToSignup()}>
            Get Started <ArrowRight size={16} style={{ marginLeft: 4 }} />
          </button>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />

        {/* Animated Geometric Shapes */}
        <div className="hero-shapes">
          <ElegantShape delay={0.3} width={600} height={140} rotate={12} gradient="rgba(139, 92, 246, 0.15)" className="shape-1" />
          <ElegantShape delay={0.5} width={500} height={120} rotate={-15} gradient="rgba(244, 63, 94, 0.12)" className="shape-2" />
          <ElegantShape delay={0.4} width={300} height={80} rotate={-8} gradient="rgba(139, 92, 246, 0.12)" className="shape-3" />
          <ElegantShape delay={0.6} width={200} height={60} rotate={20} gradient="rgba(6, 182, 212, 0.12)" className="shape-4" />
          <ElegantShape delay={0.7} width={150} height={40} rotate={-25} gradient="rgba(168, 85, 247, 0.12)" className="shape-5" />
        </div>

        <div className="hero-content">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                Trusted by 500+ organizations
              </div>
            </motion.div>

            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            >
              Your Powerful<br />
              Gateway to<br />
              Smarter Asset<br />
              Management
            </motion.h1>

            <motion.p
              className="hero-description"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            >
              Streamline your organization's entire asset lifecycle with real-time tracking,
              automated maintenance scheduling, and comprehensive reporting all in one platform.
            </motion.p>

            <motion.div
              className="hero-buttons"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <button className="btn-primary btn-hero" onClick={() => goToSignup()}>
                Get Started <ArrowRight size={18} style={{ marginLeft: 6 }} />
              </button>
            </motion.div>

            <motion.div
              className="hero-stats"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.3, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="hero-stat">
                <div className="hero-stat-value">10K+</div>
                <div className="hero-stat-label">Assets Managed</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">500+</div>
                <div className="hero-stat-label">Companies</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">99.9%</div>
                <div className="hero-stat-label">Uptime</div>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <div className="hero-3d-card">
              <div className="hero-card-header">
                <div className="hero-card-dot" style={{ background: '#f43f5e' }} />
                <div className="hero-card-dot" style={{ background: '#fbbf24' }} />
                <div className="hero-card-dot" style={{ background: '#10b981' }} />
                <span className="hero-card-title">Asset Dashboard</span>
              </div>
              <div className="hero-card-grid">
                <div className="hero-card-metric">
                  <div className="hero-card-metric-value">63</div>
                  <div className="hero-card-metric-label">Total Assets</div>
                </div>
                <div className="hero-card-metric">
                  <div className="hero-card-metric-value" style={{ color: '#10b981' }}>$80K</div>
                  <div className="hero-card-metric-label">Portfolio</div>
                </div>
                <div className="hero-card-metric">
                  <div className="hero-card-metric-value" style={{ color: '#8b5cf6' }}>19%</div>
                  <div className="hero-card-metric-label">Utilization</div>
                </div>
              </div>
              <div className="hero-card-bar">
                <div className="hero-card-bar-track">
                  <div className="hero-card-bar-fill" />
                </div>
                <div className="hero-card-bar-label">
                  <span>Asset Health</span>
                  <span>72%</span>
                </div>
              </div>
            </div>
            <motion.div
              className="hero-float-badge top-right"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 1.6 }}
            >
              <CheckCircle2 size={16} />
              Asset Allocated
            </motion.div>
            <motion.div
              className="hero-float-badge bottom-left"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 1.8 }}
            >
              <Bell size={14} />
              Maintenance Due
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom gradient fade */}
        <div className="hero-bottom-fade" />
      </section>

      {/* TRUST BAR */}
      <div className="section-divider" />
      <div className="trust-bar-wrap">
        <p className="trust-bar-headline">Trusted by 500+ organizations across the globe</p>
        <div className="trust-bar">
          <span className="trust-logo">TECHCORP</span>
          <span className="trust-logo">INNOVATE</span>
          <span className="trust-logo">BUILDFAST</span>
          <span className="trust-logo">SCALEUP</span>
          <span className="trust-logo">NEXTERA</span>
          <span className="trust-logo">DATAFLOW</span>
        </div>
      </div>
      <div className="section-divider" />

      {/* STATS BANNER */}
      <section className="stats-banner-section">
        <div className="stats-banner-grid">
          <div className="stats-banner-card">
            <div className="stats-banner-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
              <Box size={22} />
            </div>
            <div className="stats-banner-value">10,000+</div>
            <div className="stats-banner-label">Assets Tracked</div>
            <div className="stats-banner-meta">
              <TrendingUp size={12} /> Across 500+ organizations
            </div>
          </div>
          <div className="stats-banner-card">
            <div className="stats-banner-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <DollarSign size={22} />
            </div>
            <div className="stats-banner-value">$120M+</div>
            <div className="stats-banner-label">Asset Value Managed</div>
            <div className="stats-banner-meta">
              <TrendingUp size={12} /> 32% YoY growth
            </div>
          </div>
          <div className="stats-banner-card">
            <div className="stats-banner-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <Activity size={22} />
            </div>
            <div className="stats-banner-value">99.9%</div>
            <div className="stats-banner-label">Platform Uptime</div>
            <div className="stats-banner-meta">
              <ShieldCheck size={12} /> SLA-backed reliability
            </div>
          </div>
          <div className="stats-banner-card">
            <div className="stats-banner-icon" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
              <Wrench size={22} />
            </div>
            <div className="stats-banner-value">45,000+</div>
            <div className="stats-banner-label">Maintenance Tasks</div>
            <div className="stats-banner-meta">
              <TrendingUp size={12} /> Automated this year
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* CORE FEATURES */}
      <section className="section" id="features">
        <div className="section-header">
          <div className="section-label">
            <Zap size={14} />
            Core Features
          </div>
          <h2 className="section-title">
            Complete Asset Performance at Your Fingertips
          </h2>
          <p className="section-subtitle">
            Everything you need to track, manage, and optimize your organization's assets
            through their entire lifecycle.
          </p>
        </div>

        <div className="features-grid">
          <HoloCard>
            <div className="feature-icon purple">{FeatureIcons.assetMgmt}</div>
            <h3 className="feature-title">Asset Management</h3>
            <p className="feature-description">
              Track every asset from procurement to disposal. Manage asset tags, categories,
              brands, locations, and real-time status with bulk import and export capabilities.
            </p>
          </HoloCard>

          <HoloCard>
            <div className="feature-icon blue">{FeatureIcons.allocations}</div>
            <h3 className="feature-title">Smart Allocations</h3>
            <p className="feature-description">
              Assign assets to employees with full allocation tracking. Monitor active, pending,
              and returned allocations across departments with automated workflows.
            </p>
          </HoloCard>

          <HoloCard>
            <div className="feature-icon cyan">{FeatureIcons.maintenance}</div>
            <h3 className="feature-title">Preventive Maintenance</h3>
            <p className="feature-description">
              Schedule and track maintenance automatically. Get alerts for upcoming tasks,
              assign technicians, and never miss a service date with overdue notifications.
            </p>
          </HoloCard>

          <HoloCard>
            <div className="feature-icon emerald">{FeatureIcons.repairs}</div>
            <h3 className="feature-title">Repair Tracking</h3>
            <p className="feature-description">
              Log repair requests with priority levels, assign vendors and technicians,
              track costs, and monitor progress from request to completion.
            </p>
          </HoloCard>

          <HoloCard>
            <div className="feature-icon orange">{FeatureIcons.consumables}</div>
            <h3 className="feature-title">Consumables Inventory</h3>
            <p className="feature-description">
              Monitor consumable stock levels with automatic threshold alerts. Track
              cost per unit, department usage, and reorder points across locations.
            </p>
          </HoloCard>

          <HoloCard>
            <div className="feature-icon rose">{FeatureIcons.recovery}</div>
            <h3 className="feature-title">Asset Recovery</h3>
            <p className="feature-description">
              Track incidents, losses, and fund recoveries. Report damages with severity levels,
              monitor investigation status, and track recovered amounts.
            </p>
          </HoloCard>
        </div>
      </section>

      <div className="section-divider" />

      {/* SPOTLIGHT - Asset Management */}
      <section className="section">
        <div className="spotlight">
          <div className="spotlight-content">
            <div className="spotlight-label">Asset Lifecycle</div>
            <h2 className="spotlight-title">Complete Visibility Into Every Asset</h2>
            <p className="spotlight-description">
              From laptops and monitors to furniture and equipment. Track every asset
              your organization owns with detailed categorization and real-time status updates.
            </p>
            <div className="spotlight-features">
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Status Tracking:</strong> Available, Allocated, Under Maintenance, Retired, Disposed, Dead
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Bulk Operations:</strong> Import and export assets via CSV for quick onboarding
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Smart Search:</strong> Find any asset by tag, name, serial, brand, or location
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Dead Asset Tracking:</strong> Track written-off assets and their depreciated value
                </span>
              </div>
            </div>
          </div>
          <div className="spotlight-visual">
            <div className="mock-ui-header">
              <span className="mock-ui-title">Asset Management</span>
              <span className="mock-ui-badge">63 Assets</span>
            </div>
            <table className="mock-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>LAP-001</td>
                  <td>Lenovo T51</td>
                  <td>Laptop</td>
                  <td><span className="mock-status active">Active</span></td>
                </tr>
                <tr>
                  <td>MON-002</td>
                  <td>Dell Monitor</td>
                  <td>Monitor</td>
                  <td><span className="mock-status pending">Available</span></td>
                </tr>
                <tr>
                  <td>KEY-003</td>
                  <td>Keyboard</td>
                  <td>Peripheral</td>
                  <td><span className="mock-status active">Allocated</span></td>
                </tr>
                <tr>
                  <td>PRN-004</td>
                  <td>HP Printer</td>
                  <td>Printer</td>
                  <td><span className="mock-status maintenance">Maintenance</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* SPOTLIGHT - Maintenance & Repairs */}
      <section className="section">
        <div className="spotlight reverse">
          <div className="spotlight-content">
            <div className="spotlight-label">Operations</div>
            <h2 className="spotlight-title">Automate Maintenance, Streamline Repairs</h2>
            <p className="spotlight-description">
              Never miss a maintenance window again. Schedule preventive maintenance,
              manage repair workflows, and keep your assets running at peak performance.
            </p>
            <div className="spotlight-features">
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Scheduled Maintenance:</strong> Automated preventive maintenance with technician assignment
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Repair Workflow:</strong> Priority-based requests with vendor and cost tracking
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Overdue Alerts:</strong> Never miss a service date with automated notifications
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Cost Analysis:</strong> Track maintenance and repair costs per asset over time
                </span>
              </div>
            </div>
          </div>
          <div className="spotlight-visual">
            <div className="mock-ui-header">
              <span className="mock-ui-title">Operations Overview</span>
              <span className="mock-ui-badge">This Month</span>
            </div>
            <div className="mock-stats-row">
              <div className="mock-stat-card">
                <div className="mock-stat-value" style={{ color: '#8b5cf6' }}>12</div>
                <div className="mock-stat-label">Scheduled</div>
              </div>
              <div className="mock-stat-card">
                <div className="mock-stat-value" style={{ color: '#f97316' }}>3</div>
                <div className="mock-stat-label">In Progress</div>
              </div>
              <div className="mock-stat-card">
                <div className="mock-stat-value" style={{ color: '#10b981' }}>28</div>
                <div className="mock-stat-label">Completed</div>
              </div>
            </div>
            <div className="mock-chart">
              {[65, 45, 80, 55, 90, 70, 85, 50, 75, 95, 60, 82].map((h, i) => (
                <div key={i} className="mock-chart-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* SPOTLIGHT - Requests & Allocations */}
      <section className="section">
        <div className="spotlight">
          <div className="spotlight-content">
            <div className="spotlight-label">Workflow</div>
            <h2 className="spotlight-title">Request, Approve, Allocate. Seamlessly.</h2>
            <p className="spotlight-description">
              Employees can request assets, managers approve with one click, and allocations
              are tracked automatically, complete with department-level visibility.
            </p>
            <div className="spotlight-features">
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Asset Requests:</strong> Employees submit requests with urgency levels
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Approval Workflow:</strong> Pending, Approved, Fulfilled, Rejected status tracking
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Allocation History:</strong> Full audit trail of who had what and when
                </span>
              </div>
              <div className="spotlight-feature-item">
                <div className="spotlight-feature-icon"><CheckCircle2 size={14} /></div>
                <span className="spotlight-feature-text">
                  <strong>Return Management:</strong> Track asset returns and reassign efficiently
                </span>
              </div>
            </div>
          </div>
          <div className="spotlight-visual">
            <div className="mock-ui-header">
              <span className="mock-ui-title">Asset Requests</span>
              <span className="mock-ui-badge">5 Pending</span>
            </div>
            <table className="mock-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Requested By</th>
                  <th>Urgency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Lenovo Laptop</td>
                  <td>Rahul J.</td>
                  <td style={{ color: '#f43f5e' }}>High</td>
                  <td><span className="mock-status pending">Pending</span></td>
                </tr>
                <tr>
                  <td>Dell Monitor</td>
                  <td>Sarah K.</td>
                  <td style={{ color: '#f97316' }}>Medium</td>
                  <td><span className="mock-status active">Approved</span></td>
                </tr>
                <tr>
                  <td>Keyboard Set</td>
                  <td>Mike T.</td>
                  <td style={{ color: '#10b981' }}>Low</td>
                  <td><span className="mock-status active">Fulfilled</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="section-header">
          <div className="section-label">
            <Settings size={14} />
            How It Works
          </div>
          <h2 className="section-title">Get Started in Minutes</h2>
          <p className="section-subtitle">
            From setup to full asset visibility in four simple steps.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Create Your Org</h3>
            <p className="step-description">Set up your organization, departments, and locations in minutes.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Add Your Assets</h3>
            <p className="step-description">Import assets via CSV or add them individually with full details.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Assign & Track</h3>
            <p className="step-description">Allocate assets to employees and start tracking their lifecycle.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3 className="step-title">Optimize & Report</h3>
            <p className="step-description">Schedule maintenance, track repairs, and generate insights.</p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* DASHBOARD PREVIEW */}
      <section className="section" id="dashboard">
        <div className="section-header">
          <div className="section-label">
            <Monitor size={14} />
            Live Dashboard
          </div>
          <h2 className="section-title">Your Command Center for Asset Operations</h2>
          <p className="section-subtitle">
            Get a bird's eye view of your entire asset portfolio: financial summaries,
            utilization metrics, and operational health at a glance.
          </p>
        </div>

        <div className="dashboard-preview">
          <div className="dashboard-toolbar">
            <div className="dashboard-dot" style={{ background: '#f43f5e' }} />
            <div className="dashboard-dot" style={{ background: '#fbbf24' }} />
            <div className="dashboard-dot" style={{ background: '#10b981' }} />
            <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              asset.tracker | Dashboard
            </span>
          </div>
          <div className="dashboard-body">
            <div className="dashboard-sidebar">
              <div className="dashboard-sidebar-item active"><LayoutDashboard size={16} /> Dashboard</div>
              <div className="dashboard-sidebar-item"><Box size={16} /> Assets</div>
              <div className="dashboard-sidebar-item"><AlertTriangle size={16} /> Dead Assets</div>
              <div className="dashboard-sidebar-item"><Users size={16} /> Allocations</div>
              <div className="dashboard-sidebar-item"><Package size={16} /> Consumables</div>
              <div className="dashboard-sidebar-item"><ClipboardList size={16} /> Requests</div>
              <div className="dashboard-sidebar-item"><Wrench size={16} /> Maintenance</div>
              <div className="dashboard-sidebar-item"><Settings size={16} /> Repairs</div>
              <div className="dashboard-sidebar-item"><RefreshCw size={16} /> Recovery</div>
            </div>
            <div className="dashboard-main">
              <div className="dashboard-kpi-row">
                <div className="dashboard-kpi">
                  <div className="dashboard-kpi-value" style={{ color: '#8b5cf6' }}>63</div>
                  <div className="dashboard-kpi-label">Total Assets</div>
                </div>
                <div className="dashboard-kpi">
                  <div className="dashboard-kpi-value" style={{ color: '#10b981' }}>$80,312</div>
                  <div className="dashboard-kpi-label">Total Value</div>
                </div>
                <div className="dashboard-kpi">
                  <div className="dashboard-kpi-value" style={{ color: '#3b82f6' }}>19%</div>
                  <div className="dashboard-kpi-label">Utilization</div>
                </div>
                <div className="dashboard-kpi">
                  <div className="dashboard-kpi-value" style={{ color: '#fbbf24' }}>5</div>
                  <div className="dashboard-kpi-label">Active Users</div>
                </div>
              </div>
              <div className="dashboard-charts-row">
                <div className="dashboard-chart-card">
                  <div className="dashboard-chart-title">Financial Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Asset Portfolio</span>
                      <span style={{ fontWeight: 600 }}>$80,312.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avg. Asset Value</span>
                      <span style={{ fontWeight: 600 }}>$1,274.79</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Maintenance Costs</span>
                      <span style={{ fontWeight: 600, color: '#10b981' }}>$0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Repair Costs</span>
                      <span style={{ fontWeight: 600, color: '#10b981' }}>$0.00</span>
                    </div>
                  </div>
                </div>
                <div className="dashboard-chart-card">
                  <div className="dashboard-chart-title">Asset Distribution</div>
                  <div className="mock-chart" style={{ height: 100 }}>
                    {[40, 25, 15, 10, 8, 2].map((h, i) => (
                      <div key={i} className="mock-chart-bar" style={{ height: `${h * 2.5}%` }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>IT</span>
                    <span>Office</span>
                    <span>Lab</span>
                    <span>Vehicle</span>
                    <span>Other</span>
                    <span>Dead</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* SEE IT IN ACTION — REAL APP FEATURES */}
      <section className="section" id="in-action">
        <div className="section-header">
          <div className="section-label">
            <Activity size={14} />
            See It In Action
          </div>
          <h2 className="section-title">Real Features. Real Workflows.</h2>
          <p className="section-subtitle">
            These aren't stock UI screenshots. Every widget below is a working feature inside Asset Tracker.
          </p>
        </div>

        <div className="action-grid">
          {/* Audit Timeline */}
          <div className="action-card action-card-tall">
            <div className="action-card-header">
              <div className="action-card-tag">
                <ClipboardList size={12} /> Audit Trail
              </div>
              <h3 className="action-card-title">Every Change, Tracked</h3>
              <p className="action-card-desc">
                Field-level history of who changed what, when, and from where. Built for compliance.
              </p>
            </div>
            <div className="audit-timeline">
              <div className="audit-entry">
                <div className="audit-dot audit-dot-blue" />
                <div className="audit-line" />
                <div className="audit-meta">
                  <span className="audit-time">Today, 2:14 PM</span>
                  <span className="audit-badge audit-badge-blue">UPDATED</span>
                  <span className="audit-badge audit-badge-muted">ASSET</span>
                </div>
                <div className="audit-summary">
                  <strong>Lenovo T51</strong> · Sarah K.
                </div>
                <div className="audit-changes">
                  <div className="audit-change">
                    <span className="audit-field">Status:</span>
                    <span className="audit-old">Available</span>
                    <ArrowRight size={10} className="audit-arrow" />
                    <span className="audit-new">Allocated</span>
                  </div>
                  <div className="audit-change">
                    <span className="audit-field">Assignee:</span>
                    <span className="audit-old">empty</span>
                    <ArrowRight size={10} className="audit-arrow" />
                    <span className="audit-new">Rahul J.</span>
                  </div>
                </div>
              </div>

              <div className="audit-entry">
                <div className="audit-dot audit-dot-green" />
                <div className="audit-line" />
                <div className="audit-meta">
                  <span className="audit-time">Yesterday, 9:42 AM</span>
                  <span className="audit-badge audit-badge-green">CREATED</span>
                  <span className="audit-badge audit-badge-muted">MAINTENANCE</span>
                </div>
                <div className="audit-summary">
                  <strong>HP Printer</strong> · Mike T.
                </div>
                <div className="audit-summary-sub">
                  Scheduled quarterly service on Apr 28
                </div>
              </div>

              <div className="audit-entry">
                <div className="audit-dot audit-dot-blue" />
                <div className="audit-line" />
                <div className="audit-meta">
                  <span className="audit-time">Apr 25, 11:18 AM</span>
                  <span className="audit-badge audit-badge-blue">UPDATED</span>
                  <span className="audit-badge audit-badge-muted">ASSET</span>
                </div>
                <div className="audit-summary">
                  <strong>Dell Monitor</strong> · Ahmed K.
                </div>
                <div className="audit-changes">
                  <div className="audit-change">
                    <span className="audit-field">Location:</span>
                    <span className="audit-old">Floor 1</span>
                    <ArrowRight size={10} className="audit-arrow" />
                    <span className="audit-new">Floor 3</span>
                  </div>
                </div>
              </div>

              <div className="audit-entry">
                <div className="audit-dot audit-dot-green" />
                <div className="audit-meta">
                  <span className="audit-time">Apr 24, 4:05 PM</span>
                  <span className="audit-badge audit-badge-green">CREATED</span>
                  <span className="audit-badge audit-badge-muted">ASSET</span>
                </div>
                <div className="audit-summary">
                  <strong>MacBook Pro 16"</strong> · Priya S.
                </div>
                <div className="audit-summary-sub">
                  Asset added with tag LAP-064
                </div>
              </div>
            </div>
          </div>

          {/* QR Scan */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-card-tag">
                <QrCode size={12} /> QR Scan
              </div>
              <h3 className="action-card-title">Tap. Scan. Verified.</h3>
              <p className="action-card-desc">
                Anyone can scan an asset's QR sticker — no app required. Location and device captured automatically.
              </p>
            </div>
            <div className="qr-scan-mock">
              <div className="qr-scan-success">
                <CheckCircle2 size={24} />
                <div>
                  <div className="qr-scan-success-title">Asset Verified</div>
                  <div className="qr-scan-success-sub">Location logged · 2:18 PM</div>
                </div>
              </div>
              <div className="qr-scan-asset">
                <div className="qr-scan-asset-row">
                  <div className="qr-scan-asset-icon">
                    <Package size={20} />
                  </div>
                  <div>
                    <div className="qr-scan-asset-name">Lenovo ThinkPad T51</div>
                    <div className="qr-scan-asset-tag">LAP-001 · IT Department</div>
                  </div>
                </div>
                <div className="qr-scan-meta">
                  <div className="qr-scan-meta-row">
                    <MapPin size={12} />
                    <span>Floor 3 · Bandra · Mumbai</span>
                  </div>
                  <div className="qr-scan-meta-row">
                    <Smartphone size={12} />
                    <span>iOS · Safari · ±8m accuracy</span>
                  </div>
                  <div className="qr-scan-meta-row">
                    <Activity size={12} />
                    <span>Status: <span className="qr-scan-status">Allocated</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Depreciation Curve */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-card-tag">
                <DollarSign size={12} /> Depreciation
              </div>
              <h3 className="action-card-title">Watch Value Over Time</h3>
              <p className="action-card-desc">
                Automated straight-line depreciation across your portfolio. Always audit-ready.
              </p>
            </div>
            <div className="depr-mock">
              <div className="depr-stats-row">
                <div className="depr-stat">
                  <div className="depr-stat-label">Original Cost</div>
                  <div className="depr-stat-value">$80,312</div>
                </div>
                <div className="depr-stat">
                  <div className="depr-stat-label">Book Value</div>
                  <div className="depr-stat-value depr-stat-value-purple">$54,711</div>
                </div>
                <div className="depr-stat">
                  <div className="depr-stat-label">Depreciated</div>
                  <div className="depr-stat-value depr-stat-value-rose">−32%</div>
                </div>
              </div>
              <svg viewBox="0 0 320 110" className="depr-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="deprGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,15 L40,22 L80,32 L120,42 L160,55 L200,68 L240,80 L280,90 L320,98 L320,110 L0,110 Z"
                  fill="url(#deprGrad)"
                />
                <path
                  d="M0,15 L40,22 L80,32 L120,42 L160,55 L200,68 L240,80 L280,90 L320,98"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="160" cy="55" r="4" fill="#a78bfa" />
                <circle cx="160" cy="55" r="8" fill="#a78bfa" opacity="0.25" />
              </svg>
              <div className="depr-x-axis">
                <span>Y0</span><span>Y1</span><span>Y2</span><span>Y3</span><span>Y4</span><span>Y5</span>
              </div>
            </div>
          </div>

          {/* Maintenance Compliance */}
          <div className="action-card action-card-wide">
            <div className="action-card-header">
              <div className="action-card-tag">
                <Wrench size={12} /> Maintenance
              </div>
              <h3 className="action-card-title">Stay Ahead of Every Service Date</h3>
              <p className="action-card-desc">
                Auto-scheduled preventive maintenance with clear visual status, technician assignment, and overdue alerts.
              </p>
            </div>
            <div className="maint-mock">
              <div className="maint-progress-row">
                <div className="maint-progress-card">
                  <div className="maint-progress-title">Compliance Rate</div>
                  <div className="maint-progress-big">94%</div>
                  <div className="maint-bar">
                    <div className="maint-bar-fill" style={{ width: '94%', background: '#10b981' }} />
                  </div>
                </div>
                <div className="maint-progress-card">
                  <div className="maint-progress-title">On-Time</div>
                  <div className="maint-progress-big">87%</div>
                  <div className="maint-bar">
                    <div className="maint-bar-fill" style={{ width: '87%', background: '#3b82f6' }} />
                  </div>
                </div>
                <div className="maint-progress-card">
                  <div className="maint-progress-title">Overdue</div>
                  <div className="maint-progress-big maint-progress-big-rose">3</div>
                  <div className="maint-bar">
                    <div className="maint-bar-fill" style={{ width: '12%', background: '#fb7185' }} />
                  </div>
                </div>
              </div>
              <div className="maint-task-list">
                <div className="maint-task">
                  <div className="maint-task-dot" style={{ background: '#10b981' }} />
                  <div className="maint-task-name">Quarterly HVAC Filter</div>
                  <span className="maint-task-tech">Mike T.</span>
                  <span className="maint-task-status maint-task-status-done">Completed</span>
                </div>
                <div className="maint-task">
                  <div className="maint-task-dot" style={{ background: '#3b82f6' }} />
                  <div className="maint-task-name">Printer Calibration · HP-204</div>
                  <span className="maint-task-tech">Sarah K.</span>
                  <span className="maint-task-status maint-task-status-progress">In Progress</span>
                </div>
                <div className="maint-task">
                  <div className="maint-task-dot" style={{ background: '#fbbf24' }} />
                  <div className="maint-task-name">Server Rack Cleaning</div>
                  <span className="maint-task-tech">Ahmed K.</span>
                  <span className="maint-task-status maint-task-status-scheduled">Scheduled</span>
                </div>
                <div className="maint-task">
                  <div className="maint-task-dot" style={{ background: '#fb7185' }} />
                  <div className="maint-task-name">UPS Battery Test · Floor 2</div>
                  <span className="maint-task-tech">Unassigned</span>
                  <span className="maint-task-status maint-task-status-overdue">2d Overdue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* SOLUTIONS / USE CASES */}
      <section className="section" id="solutions">
        <div className="section-header">
          <div className="section-label">
            <Briefcase size={14} />
            Solutions
          </div>
          <h2 className="section-title">Built for Every Team That Manages Assets</h2>
          <p className="section-subtitle">
            From IT to facilities to manufacturing. Asset Tracker adapts to how your team works.
          </p>
        </div>

        <div className="solutions-grid">
          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
              <Monitor size={20} />
            </div>
            <h3 className="solution-title">IT Departments</h3>
            <p className="solution-desc">
              Track laptops, monitors, peripherals, and software licenses across every employee and location.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Hardware lifecycle management</li>
              <li><CheckCircle2 size={14} /> License & warranty tracking</li>
              <li><CheckCircle2 size={14} /> Onboarding & offboarding flows</li>
            </ul>
          </div>

          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
              <Building2 size={20} />
            </div>
            <h3 className="solution-title">Facilities Teams</h3>
            <p className="solution-desc">
              Manage office furniture, HVAC, electrical equipment, and shared workspace assets with ease.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Preventive maintenance</li>
              <li><CheckCircle2 size={14} /> Vendor & repair coordination</li>
              <li><CheckCircle2 size={14} /> Multi-location oversight</li>
            </ul>
          </div>

          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <Factory size={20} />
            </div>
            <h3 className="solution-title">Manufacturing</h3>
            <p className="solution-desc">
              Monitor machinery, tools, and production equipment with real-time status and uptime metrics.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Equipment uptime tracking</li>
              <li><CheckCircle2 size={14} /> Spare-parts inventory</li>
              <li><CheckCircle2 size={14} /> Audit-ready compliance logs</li>
            </ul>
          </div>

          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
              <Hospital size={20} />
            </div>
            <h3 className="solution-title">Healthcare</h3>
            <p className="solution-desc">
              Track medical devices, calibration cycles, and inventory with strict audit trail support.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Calibration scheduling</li>
              <li><CheckCircle2 size={14} /> Regulatory compliance</li>
              <li><CheckCircle2 size={14} /> Device serial tracing</li>
            </ul>
          </div>

          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              <GraduationCap size={20} />
            </div>
            <h3 className="solution-title">Education</h3>
            <p className="solution-desc">
              Manage classroom equipment, lab tools, and library assets across campuses and departments.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Multi-campus support</li>
              <li><CheckCircle2 size={14} /> Student & staff allocations</li>
              <li><CheckCircle2 size={14} /> Bulk QR labeling</li>
            </ul>
          </div>

          <div className="solution-card">
            <div className="solution-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#22d3ee' }}>
              <BarChart3 size={20} />
            </div>
            <h3 className="solution-title">Finance & Audit</h3>
            <p className="solution-desc">
              Get depreciation reports, asset valuations, and complete audit trails for every transaction.
            </p>
            <ul className="solution-list">
              <li><CheckCircle2 size={14} /> Depreciation calculations</li>
              <li><CheckCircle2 size={14} /> Cost-center reporting</li>
              <li><CheckCircle2 size={14} /> CSV & Excel exports</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* INTEGRATIONS */}
      <section className="section" id="integrations">
        <div className="section-header">
          <div className="section-label">
            <Plug size={14} />
            Integrations
          </div>
          <h2 className="section-title">Plays Nicely With Your Existing Stack</h2>
          <p className="section-subtitle">
            Connect Asset Tracker to the tools your team already uses. Native integrations, plus a full REST API.
          </p>
        </div>

        <div className="integrations-grid">
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
              <QrCode size={22} />
            </div>
            <div className="integration-name">QR Scanning</div>
            <div className="integration-meta">Native</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div className="integration-name">Excel & CSV</div>
            <div className="integration-meta">Bulk Import</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
              <Mail size={22} />
            </div>
            <div className="integration-name">Gmail API</div>
            <div className="integration-meta">Notifications</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
              <Globe size={22} />
            </div>
            <div className="integration-name">Google Workspace</div>
            <div className="integration-meta">SSO Ready</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
              <Smartphone size={22} />
            </div>
            <div className="integration-name">Mobile Web</div>
            <div className="integration-meta">PWA</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              <FileText size={22} />
            </div>
            <div className="integration-name">PDF Reports</div>
            <div className="integration-meta">Auto-generated</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#22d3ee' }}>
              <Database size={22} />
            </div>
            <div className="integration-name">Supabase</div>
            <div className="integration-meta">Backend</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
              <Code2 size={22} />
            </div>
            <div className="integration-name">REST API</div>
            <div className="integration-meta">Developer-ready</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <Webhook size={22} />
            </div>
            <div className="integration-name">Webhooks</div>
            <div className="integration-meta">Real-time events</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
              <Lock size={22} />
            </div>
            <div className="integration-name">SSO / SAML</div>
            <div className="integration-meta">Enterprise</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
              <MapPin size={22} />
            </div>
            <div className="integration-name">Multi-Location</div>
            <div className="integration-meta">Geo Tagging</div>
          </div>
          <div className="integration-card">
            <div className="integration-logo" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
              <Plus size={22} />
            </div>
            <div className="integration-name">More Coming</div>
            <div className="integration-meta">Slack, Teams, Jira</div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* WHY CHOOSE US — COMPARISON */}
      <section className="section" id="why-us">
        <div className="section-header">
          <div className="section-label">
            <Award size={14} />
            Why Asset Tracker
          </div>
          <h2 className="section-title">The Modern Alternative to Spreadsheets</h2>
          <p className="section-subtitle">
            See how Asset Tracker stacks up against the old way and against generic CMMS tools.
          </p>
        </div>

        <div className="comparison-wrap">
          <div className="comparison-table">
            <div className="comparison-row comparison-head">
              <div className="comparison-feature">Capability</div>
              <div className="comparison-col comparison-col-us">
                <div className="comparison-col-name">
                  <Box size={16} /> Asset Tracker
                </div>
                <div className="comparison-col-tag">Recommended</div>
              </div>
              <div className="comparison-col">
                <div className="comparison-col-name">
                  <FileSpreadsheet size={16} /> Spreadsheets
                </div>
                <div className="comparison-col-tag muted">The old way</div>
              </div>
              <div className="comparison-col">
                <div className="comparison-col-name">
                  <Settings size={16} /> Generic CMMS
                </div>
                <div className="comparison-col-tag muted">Heavy & costly</div>
              </div>
            </div>

            {[
              { label: 'Real-time asset tracking', us: true, ss: false, cmms: true },
              { label: 'Built-in QR labeling', us: true, ss: false, cmms: false },
              { label: 'Automated maintenance scheduling', us: true, ss: false, cmms: true },
              { label: 'Per-organization currency & locale', us: true, ss: false, cmms: false },
              { label: 'Asset request approval workflow', us: true, ss: false, cmms: false },
              { label: 'Depreciation & financial reporting', us: true, ss: false, cmms: true },
              { label: 'Setup in under 10 minutes', us: true, ss: true, cmms: false },
              { label: 'Audit trail for every change', us: true, ss: false, cmms: true },
              { label: 'Affordable for small teams', us: true, ss: true, cmms: false },
            ].map((row, i) => (
              <div key={i} className="comparison-row">
                <div className="comparison-feature">{row.label}</div>
                <div className="comparison-cell comparison-col-us">
                  {row.us ? <CheckCircle2 size={18} className="cmp-yes" /> : <XCircle size={18} className="cmp-no" />}
                </div>
                <div className="comparison-cell">
                  {row.ss ? <CheckCircle2 size={18} className="cmp-yes" /> : <XCircle size={18} className="cmp-no" />}
                </div>
                <div className="comparison-cell">
                  {row.cmms ? <CheckCircle2 size={18} className="cmp-yes" /> : <XCircle size={18} className="cmp-no" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* SECURITY & COMPLIANCE */}
      <section className="section">
        <div className="security-strip">
          <div className="security-strip-header">
            <div className="section-label">
              <ShieldCheck size={14} />
              Security & Trust
            </div>
            <h2 className="security-strip-title">Enterprise-Grade Security From Day One</h2>
            <p className="security-strip-sub">
              Your asset data is protected with the same standards used by the world's largest organizations.
            </p>
          </div>
          <div className="security-strip-grid">
            <div className="security-badge">
              <Lock size={20} />
              <div>
                <div className="security-badge-title">256-bit Encryption</div>
                <div className="security-badge-sub">In transit & at rest</div>
              </div>
            </div>
            <div className="security-badge">
              <ShieldCheck size={20} />
              <div>
                <div className="security-badge-title">SOC 2 Aligned</div>
                <div className="security-badge-sub">Audit-ready controls</div>
              </div>
            </div>
            <div className="security-badge">
              <Award size={20} />
              <div>
                <div className="security-badge-title">GDPR Ready</div>
                <div className="security-badge-sub">Data privacy first</div>
              </div>
            </div>
            <div className="security-badge">
              <Database size={20} />
              <div>
                <div className="security-badge-title">Daily Backups</div>
                <div className="security-badge-sub">99.9% durability</div>
              </div>
            </div>
            <div className="security-badge">
              <Activity size={20} />
              <div>
                <div className="security-badge-title">99.9% Uptime</div>
                <div className="security-badge-sub">SLA-backed</div>
              </div>
            </div>
            <div className="security-badge">
              <Users size={20} />
              <div>
                <div className="security-badge-title">Role-Based Access</div>
                <div className="security-badge-sub">Granular permissions</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="section-header">
          <div className="section-label">
            <DollarSign size={14} />
            Pricing
          </div>
          <h2 className="section-title">Simple, Transparent Pricing</h2>
          <p className="section-subtitle">Choose the plan that fits your organization. No hidden fees.</p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-plan">Beginner</div>
            <div className="pricing-price">$0 <span>/ mo</span></div>
            <p className="pricing-price-annual">$0/year</p>
            <p className="pricing-desc">For small teams getting started</p>
            <ul className="pricing-features">
              <li><CheckCircle2 size={16} className="pricing-check" /> Up to 50 Assets</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 5 Users</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 1 Location</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 10 QR Batch</li>
            </ul>
            <div className="pricing-tags">
              <span className="pricing-tag">Audits</span>
              <span className="pricing-tag">Adv. Filters</span>
              <span className="pricing-tag">Custom Columns</span>
              <span className="pricing-tag">Bulk QR</span>
              <span className="pricing-tag">Depreciation</span>
              <span className="pricing-tag">Reports</span>
              <span className="pricing-tag">Documents</span>
              <span className="pricing-tag">Procurement</span>
            </div>
            <button className="btn-primary btn-pricing" onClick={() => goToSignup('beginner')}>
              Get Started <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </button>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-plan">Pro</div>
            <div className="pricing-price">$29.99 <span>/ mo</span></div>
            <p className="pricing-price-annual">$299.99/year</p>
            <p className="pricing-desc">For growing organizations</p>
            <ul className="pricing-features">
              <li><CheckCircle2 size={16} className="pricing-check" /> Up to 500 Assets</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 25 Users</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 5 Locations</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> 50 QR Batch</li>
            </ul>
            <div className="pricing-tags">
              <span className="pricing-tag">Audits</span>
              <span className="pricing-tag">Adv. Filters</span>
              <span className="pricing-tag">Custom Columns</span>
              <span className="pricing-tag">Bulk QR</span>
              <span className="pricing-tag">Depreciation</span>
              <span className="pricing-tag">Reports</span>
              <span className="pricing-tag">Documents</span>
              <span className="pricing-tag">Procurement</span>
            </div>
            <button className="btn-primary btn-pricing" onClick={() => goToSignup('pro')}>
              Get Started <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </button>
          </div>

          <div className="pricing-card">
            <div className="pricing-plan">Premium</div>
            <div className="pricing-price">$79.99 <span>/ mo</span></div>
            <p className="pricing-price-annual">$799.99/year</p>
            <p className="pricing-desc">For large-scale operations</p>
            <ul className="pricing-features">
              <li><CheckCircle2 size={16} className="pricing-check" /> Unlimited Assets</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> Unlimited Users</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> Unlimited Locations</li>
              <li><CheckCircle2 size={16} className="pricing-check" /> Unlimited QR Batch</li>
            </ul>
            <div className="pricing-tags">
              <span className="pricing-tag">Audits</span>
              <span className="pricing-tag">Adv. Filters</span>
              <span className="pricing-tag">Custom Columns</span>
              <span className="pricing-tag">Bulk QR</span>
              <span className="pricing-tag">Depreciation</span>
              <span className="pricing-tag">Reports</span>
              <span className="pricing-tag">Documents</span>
              <span className="pricing-tag">Procurement</span>
            </div>
            <button className="btn-primary btn-pricing" onClick={() => goToSignup('premium')}>
              Get Started <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* TESTIMONIALS */}
      <section className="section">
        <div className="section-header">
          <div className="section-label">
            <Star size={14} />
            Testimonials
          </div>
          <h2 className="section-title">Loved by Operations Teams</h2>
          <p className="section-subtitle">See what our customers have to say about Asset Tracker.</p>
        </div>

        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="testimonial-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#fbbf24" />)}
            </div>
            <p className="testimonial-text">
              "Asset Tracker completely transformed how we manage our IT equipment.
              We went from spreadsheets to full visibility in a week."
            </p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">R</div>
              <div>
                <div className="testimonial-name">Rahul Sharma</div>
                <div className="testimonial-role">IT Manager, TechCorp</div>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div className="testimonial-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#fbbf24" />)}
            </div>
            <p className="testimonial-text">
              "The maintenance scheduling alone saved us thousands in repair costs.
              The dashboard gives me everything I need at a glance."
            </p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">S</div>
              <div>
                <div className="testimonial-name">Sarah Chen</div>
                <div className="testimonial-role">Operations Lead, ScaleUp</div>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <div className="testimonial-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#fbbf24" />)}
            </div>
            <p className="testimonial-text">
              "The asset request workflow is brilliant. Employees request, managers approve,
              and everything is tracked automatically. No more lost equipment."
            </p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">A</div>
              <div>
                <div className="testimonial-name">Ahmed Khan</div>
                <div className="testimonial-role">Facilities Director, BuildFast</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="section-header">
          <div className="section-label">
            <HelpCircle size={14} />
            FAQ
          </div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know before getting started. Can't find what you're looking for?{' '}
            <a className="faq-contact-link" onClick={() => goToSignup()}>Contact us</a>.
          </p>
        </div>

        <div className="faq-list">
          {[
            {
              q: 'How quickly can my team get up and running?',
              a: 'Most teams complete setup in under 10 minutes. Create your organization, import your existing asset list via CSV (or add them manually), invite teammates, and start tracking. No long onboarding calls required.',
            },
            {
              q: 'Can I import my existing asset data?',
              a: 'Yes. We support bulk CSV import with field mapping for asset tags, names, categories, brands, locations, purchase dates, costs, and custom columns. Most spreadsheets work out of the box.',
            },
            {
              q: 'Does Asset Tracker support QR codes?',
              a: 'Absolutely. Generate QR labels for any asset (single or batch) and let employees scan them on their phone to view, request, or report issues. No app install required — it works in any browser.',
            },
            {
              q: 'How does pricing work for multiple locations?',
              a: 'Each plan includes a set number of locations. Pro covers up to 5, and Premium gives you unlimited locations and users. You can switch plans anytime from your dashboard.',
            },
            {
              q: 'Is my data secure?',
              a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We run daily backups and use role-based access control so only the right people see the right data.',
            },
            {
              q: 'Can I get a custom plan or enterprise contract?',
              a: 'Yes. For larger organizations, we offer custom contracts with SSO/SAML, dedicated support, custom SLAs, and white-label options. Reach out and we will scope it together.',
            },
            {
              q: 'What happens if I want to cancel?',
              a: 'You can cancel anytime from billing settings. Your data stays accessible during your billing period, and we provide a full CSV export of every asset, allocation, and audit log on request.',
            },
            {
              q: 'Do you offer integrations and an API?',
              a: 'Yes. Asset Tracker ships with a full REST API and webhook support so you can connect it to your HRIS, ITSM, or accounting tool. Native Slack, Teams, and Jira integrations are on the roadmap.',
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`faq-item ${openFaq === i ? 'open' : ''}`}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div className="faq-question">
                <span>{item.q}</span>
                <span className="faq-icon">
                  {openFaq === i ? <X size={18} /> : <Plus size={18} />}
                </span>
              </div>
              {openFaq === i && (
                <div className="faq-answer">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div className="cta-content">
          <h2 className="cta-title">Ready to Take Control of Your Assets?</h2>
          <p className="cta-subtitle">
            Get started today. No credit card required.
            Set up in minutes, see results immediately.
          </p>
          <div className="cta-buttons">
            <button className="btn-primary btn-hero" onClick={() => goToSignup()}>
              Get Started <ArrowRight size={18} style={{ marginLeft: 6 }} />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content footer-content-wide">
          <div className="footer-brand">
            <div className="nav-logo" style={{ marginBottom: 16 }}>
              <div className="nav-logo-icon">
                <Box size={20} />
              </div>
              Asset Tracker
            </div>
            <p className="footer-brand-description">
              Streamline your organization's asset lifecycle with real-time tracking,
              automated maintenance, and comprehensive reporting.
            </p>
            <div className="footer-badges">
              <span className="footer-badge"><ShieldCheck size={12} /> SOC 2 Aligned</span>
              <span className="footer-badge"><Lock size={12} /> Encrypted</span>
              <span className="footer-badge"><Award size={12} /> GDPR Ready</span>
            </div>
          </div>
          <div>
            <h4 className="footer-col-title">Product</h4>
            <ul className="footer-links">
              <li><a onClick={scrollToSection('features')}>Features</a></li>
              <li><a onClick={scrollToSection('solutions')}>Solutions</a></li>
              <li><a onClick={scrollToSection('integrations')}>Integrations</a></li>
              <li><a onClick={scrollToSection('dashboard')}>Dashboard</a></li>
              <li><a onClick={scrollToSection('pricing')}>Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Solutions</h4>
            <ul className="footer-links">
              <li><a onClick={scrollToSection('solutions')}>IT Departments</a></li>
              <li><a onClick={scrollToSection('solutions')}>Facilities</a></li>
              <li><a onClick={scrollToSection('solutions')}>Manufacturing</a></li>
              <li><a onClick={scrollToSection('solutions')}>Healthcare</a></li>
              <li><a onClick={scrollToSection('solutions')}>Education</a></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Resources</h4>
            <ul className="footer-links">
              <li><a onClick={scrollToSection('faq')}>FAQ</a></li>
              <li><a onClick={scrollToSection('how-it-works')}>How it Works</a></li>
              <li><a>Documentation</a></li>
              <li><a>API Reference</a></li>
              <li><a>Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Company</h4>
            <ul className="footer-links">
              <li><a>About</a></li>
              <li><a>Blog</a></li>
              <li><a>Careers</a></li>
              <li><a>Contact</a></li>
              <li><a onClick={goToLogin}>Sign In</a></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Legal</h4>
            <ul className="footer-links">
              <li><a>Privacy Policy</a></li>
              <li><a>Terms of Service</a></li>
              <li><a>Cookie Policy</a></li>
              <li><a>Security</a></li>
              <li><a>DPA</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Asset Tracker by 1XL Ventures. All rights reserved.</span>
          <span>Built with purpose.</span>
        </div>
      </footer>
    </div>
  );
}
