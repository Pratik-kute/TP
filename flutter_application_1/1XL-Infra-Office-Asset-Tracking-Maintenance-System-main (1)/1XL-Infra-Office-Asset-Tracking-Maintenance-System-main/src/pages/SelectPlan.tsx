import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Box, CheckCircle2, DollarSign, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { arrayToCamel } from '../lib/caseMapper';
import type { SubscriptionPlan } from '../types';
import ElegantShape from '../components/landing/ElegantShape';
import { useTheme } from '../contexts/ThemeContext';
import './Landing.css';

/** Hardcoded fallback used when `subscription_plans` is empty or unreachable.
 *  The landing page's pricing section shows exactly these tiers. */
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'fallback-beginner', name: 'beginner', displayName: 'Beginner',
    maxAssets: 50, maxUsers: 5, maxLocations: 1, qrBatchLimit: 10,
    hasAuditPage: false, hasAdvancedFilters: false, hasColumnCustomization: false,
    hasBulkQrExport: false, hasDepreciation: false, hasReports: false,
    hasDocuments: false, hasProcurement: false,
    priceMonthly: 0, priceYearly: 0, discountPercent: 0, discountNote: '', isActive: true, createdAt: '',
  },
  {
    id: 'fallback-pro', name: 'pro', displayName: 'Pro',
    maxAssets: 500, maxUsers: 25, maxLocations: 5, qrBatchLimit: 50,
    hasAuditPage: true, hasAdvancedFilters: true, hasColumnCustomization: true,
    hasBulkQrExport: false, hasDepreciation: true, hasReports: true,
    hasDocuments: true, hasProcurement: false,
    priceMonthly: 29.99, priceYearly: 299.99, discountPercent: 0, discountNote: '', isActive: true, createdAt: '',
  },
  {
    id: 'fallback-premium', name: 'premium', displayName: 'Premium',
    maxAssets: -1, maxUsers: -1, maxLocations: -1, qrBatchLimit: -1,
    hasAuditPage: true, hasAdvancedFilters: true, hasColumnCustomization: true,
    hasBulkQrExport: true, hasDepreciation: true, hasReports: true,
    hasDocuments: true, hasProcurement: true,
    priceMonthly: 79.99, priceYearly: 799.99, discountPercent: 0, discountNote: '', isActive: true, createdAt: '',
  },
];

function formatLimit(n: number): string {
  return n === -1 ? 'Unlimited' : String(n);
}

export default function SelectPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedName = searchParams.get('plan');
  const { isDark, toggleTheme } = useTheme();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Fetch plans from Supabase, fall back to hardcoded tiers if the query
  // fails, returns nothing, or takes longer than 4 seconds.
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setPlans(FALLBACK_PLANS);
        setLoading(false);
      }
    }, 4000);

    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (error || !data || data.length === 0) {
          setPlans(FALLBACK_PLANS);
        } else {
          setPlans(arrayToCamel<SubscriptionPlan>(data));
        }
        setLoading(false);
      });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  // Once plans have loaded, pick an initial selection:
  //  - If the URL preselected a plan that exists → use it
  //  - Otherwise default to the featured "pro" plan, or the first plan
  // Running this in a single effect avoids a race between two state
  // updaters both firing during the same render after plans load.
  useEffect(() => {
    if (plans.length === 0 || selectedPlanId) return;
    if (preselectedName) {
      const match = plans.find(p => p.name === preselectedName);
      if (match) {
        setSelectedPlanId(match.id);
        return;
      }
    }
    const pro = plans.find(p => p.name === 'pro');
    setSelectedPlanId(pro?.id ?? plans[0].id);
  }, [plans, preselectedName, selectedPlanId]);

  const featuredName = 'pro';

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const handleContinue = () => {
    if (!selectedPlan) return;
    navigate(`/signup/create?plan=${selectedPlan.name}&cycle=${billingCycle}`);
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
          <div className="nav-logo-icon"><Box size={20} /></div>
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

      <div className="auth-shell">
        <div className="auth-shell-bg" />
        <div className="auth-shell-grid" />
        <div className="auth-shell-shapes">
          <ElegantShape delay={0.2} width={560} height={130} rotate={12} gradient="rgba(139, 92, 246, 0.15)" className="shape-1" />
          <ElegantShape delay={0.4} width={440} height={110} rotate={-15} gradient="rgba(244, 63, 94, 0.1)" className="shape-2" />
          <ElegantShape delay={0.55} width={240} height={70} rotate={-8} gradient="rgba(6, 182, 212, 0.12)" className="shape-4" />
        </div>

        <motion.div
          className="signup-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="signup-header">
            <div className="section-label" style={{ justifyContent: 'center', display: 'inline-flex' }}>
              <DollarSign size={14} />
              Choose Your Plan
            </div>
            <h1 className="signup-header-title">Pick the plan that fits your team</h1>
            <p className="signup-header-sub">
              You can upgrade, downgrade, or cancel anytime. All plans include a full-featured
              org workspace with role-based access.
            </p>
          </div>

          <div className="signup-toggle-wrap">
            <div className="signup-billing-toggle">
              <button
                type="button"
                className={billingCycle === 'monthly' ? 'active' : ''}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={billingCycle === 'yearly' ? 'active' : ''}
                onClick={() => setBillingCycle('yearly')}
              >
                Yearly <span className="signup-billing-toggle-save">Save ~17%</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
              <span className="spinner-sm" /> Loading plans...
            </div>
          ) : (
            <div className="signup-plans-grid">
              {plans.map(plan => {
                const isSelected = plan.id === selectedPlanId;
                const isFeatured = plan.name === featuredName;
                const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
                const perLabel = billingCycle === 'monthly' ? '/ mo' : '/ yr';
                return (
                  <div
                    key={plan.id}
                    className={`signup-plan-card ${isFeatured ? 'featured' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlanId(plan.id); }}
                  >
                    <div className="signup-plan-name">{plan.displayName}</div>
                    <div className="signup-plan-price">
                      ${Number(price).toLocaleString(undefined, { minimumFractionDigits: price % 1 === 0 ? 0 : 2 })} <span>{perLabel}</span>
                    </div>
                    <p className="signup-plan-annual">
                      {billingCycle === 'monthly'
                        ? `$${Number(plan.priceYearly).toLocaleString()}/year billed annually`
                        : `Equivalent to $${(Number(plan.priceYearly) / 12).toFixed(2)}/month`}
                    </p>
                    <p className="signup-plan-desc">
                      {plan.name === 'beginner' && 'For small teams getting started with asset tracking.'}
                      {plan.name === 'pro' && 'For growing organizations that need advanced features.'}
                      {plan.name === 'premium' && 'For large operations with unlimited scale.'}
                      {!['beginner', 'pro', 'premium'].includes(plan.name) && 'A flexible plan to fit your team.'}
                    </p>
                    <ul className="signup-plan-limits">
                      <li><CheckCircle2 size={15} /> {formatLimit(plan.maxAssets)} assets</li>
                      <li><CheckCircle2 size={15} /> {formatLimit(plan.maxUsers)} users</li>
                      <li><CheckCircle2 size={15} /> {formatLimit(plan.maxLocations)} locations</li>
                      <li><CheckCircle2 size={15} /> {formatLimit(plan.qrBatchLimit)} QR batch</li>
                    </ul>
                    <div className="signup-plan-select">
                      {isSelected ? 'Selected' : 'Select plan'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="signup-continue-row">
            <button
              className="auth-submit-btn"
              style={{ maxWidth: 320 }}
              disabled={!selectedPlan}
              onClick={handleContinue}
            >
              Continue <ArrowRight size={18} style={{ marginLeft: 6 }} />
            </button>
          </div>

          <p className="auth-footnote" style={{ marginTop: 24 }}>
            Already have an account?{' '}
            <button type="button" className="auth-link" onClick={() => navigate('/login')}>
              Sign in
            </button>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
