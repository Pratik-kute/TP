import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Box, Building2, ChevronDown, Eye, EyeOff, Sun, Moon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { objectToCamel } from '../lib/caseMapper';
import type { Organization, SubscriptionPlan } from '../types';
import ElegantShape from '../components/landing/ElegantShape';
import { sendSignupWelcomeEmail } from '../lib/signupWelcomeEmail';
import { useTheme } from '../contexts/ThemeContext';
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, formatCurrency } from '../utils/helpers';

import './Landing.css';

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + digits + symbols;
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  // Guarantee at least one of each character class
  const pwd = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
    ...Array.from(arr.slice(4), b => all[b % all.length]),
  ];
  // Shuffle deterministically using the random bytes
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
}

const CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  AED: 3.67,
  CAD: 1.36,
  AUD: 1.53,
  SGD: 1.34,
  SAR: 3.75,
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.385,
  KWD: 0.307,
  JPY: 149.5,
  VND: 24500,
};

interface FormState {
  orgName: string;
  orgShortName: string;
  industry: string;
  country: string;
  currency: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminPasswordConfirm: string;
}

const INITIAL_FORM: FormState = {
  orgName: '',
  orgShortName: '',
  industry: '',
  country: '',
  currency: 'USD',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  adminPasswordConfirm: '',
};

/** Default access for all org roles on a brand new org — matches the
 *  "always enabled" set from SuperAdmin's create-org dialog. */
const DEFAULT_ENABLED_PAGES = [
  'assets',
  'allocations',
  'audit-logs',
];
const DEFAULT_ROLES = ['manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'];

export default function CreateOrg() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planName = searchParams.get('plan') || 'beginner';
  const billingCycle = (searchParams.get('cycle') as 'monthly' | 'yearly') || 'monthly';
  const { isDark, toggleTheme } = useTheme();

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingSuccessUrl, setPendingSuccessUrl] = useState<string | null>(null);
  const [suggestedPwd, setSuggestedPwd] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Country searchable dropdown state
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const countryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!countryOpen) return;
    // Auto-focus the inline search input when dropdown opens
    setTimeout(() => countryInputRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  // Fetch the plan row so we know the id (needed for organization_subscriptions)
  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlan(objectToCamel<SubscriptionPlan>(data));
      });
  }, [planName]);

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleCountrySelect = (code: string) => {
    const country = SUPPORTED_COUNTRIES.find(c => c.code === code);
    if (!country) return;
    // Auto-set phone: replace dial code prefix if phone is empty or only contains the old code
    const oldCountry = SUPPORTED_COUNTRIES.find(c => c.code === form.country);
    const oldDial = oldCountry?.dialCode ?? '';
    let newPhone = form.adminPhone;
    if (!newPhone.trim() || newPhone.trim() === oldDial) {
      newPhone = country.dialCode + ' ';
    } else if (oldDial && newPhone.startsWith(oldDial)) {
      newPhone = country.dialCode + newPhone.slice(oldDial.length);
    }
    setForm(prev => ({ ...prev, country: code, currency: country.currency, adminPhone: newPhone }));
    setCountryOpen(false);
    setCountrySearch('');
  };

  const validate = (): string | null => {
    if (!form.orgName.trim()) return 'Organization name is required.';
    if (!form.orgShortName.trim()) return 'Short name is required.';
    if (form.orgShortName.trim().length < 2 || form.orgShortName.trim().length > 10) {
      return 'Short name must be 2–10 characters (used in your URLs).';
    }
    if (!/^[a-zA-Z0-9-]+$/.test(form.orgShortName.trim())) {
      return 'Short name can only contain letters, numbers, and dashes.';
    }
    if (!form.adminName.trim()) return 'Your name is required.';
    if (!form.adminEmail.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) return 'Please enter a valid email.';
    if (!form.adminPassword) return 'Password is required.';
    if (form.adminPassword.length < 8) return 'Password must be at least 8 characters.';
    if (form.adminPassword !== form.adminPasswordConfirm) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const shortName = form.orgShortName.trim().toUpperCase();
    const adminEmail = form.adminEmail.trim().toLowerCase();

    try {
      // 1. Make sure the short name isn't taken
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('short_name', shortName)
        .maybeSingle();
      if (existingOrg) {
        throw new Error(`Short name "${shortName}" is already taken. Try something else.`);
      }

      // 2. Make sure the email isn't already registered
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', adminEmail)
        .maybeSingle();
      if (existingUser) {
        throw new Error('An account with this email already exists. Try signing in instead.');
      }

      // 3. Build default page_permissions JSONB
      const pagePerms: Record<string, string[]> = {};
      DEFAULT_ROLES.forEach(role => {
        pagePerms[role] = [...DEFAULT_ENABLED_PAGES];
      });

      // 4. Insert organization
      const { data: newOrgRow, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: form.orgName.trim(),
          short_name: shortName,
          contact_email: adminEmail,
          contact_phone: form.adminPhone.trim(),
          industry: form.industry.trim(),
          country: form.country || null,
          currency: form.currency,
          is_active: true,
          page_permissions: pagePerms,
        })
        .select()
        .single();
      if (orgErr) throw orgErr;
      const newOrg = objectToCamel<Organization>(newOrgRow);

      // 5. Insert subscription (best-effort; missing plan should not block signup)
      if (plan) {
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { error: subErr } = await supabase.from('organization_subscriptions').insert({
          organization_id: newOrg.id,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          started_at: now,
          expires_at: expiresAt,
          auto_renew: true,
        });
        if (subErr) {
          console.warn('[CreateOrg] Failed to create subscription row:', subErr);
        }
      }

      // 6. Insert admin user (plaintext password matches existing AuthContext pattern)
      const { error: userErr } = await supabase.from('users').insert({
        name: form.adminName.trim(),
        email: adminEmail,
        password: form.adminPassword,
        role: 'admin',
        phone: form.adminPhone.trim(),
        is_active: true,
        is_global_admin: false,
        organization_id: newOrg.id,
      });
      if (userErr) {
        // Best-effort cleanup so we don't orphan an empty org
        await supabase.from('organizations').delete().eq('id', newOrg.id);
        throw userErr;
      }

      // 7. Send welcome email with login credentials
      const loginUrl = `${window.location.origin}/#/login`;
      const successUrl =
        `/signup/success?org=${encodeURIComponent(newOrg.name)}` +
        `&shortName=${encodeURIComponent(newOrg.shortName)}` +
        `&email=${encodeURIComponent(adminEmail)}`;

      const emailResult = await sendSignupWelcomeEmail({
        eventType: 'signup_welcome',
        orgName: newOrg.name,
        orgShortName: newOrg.shortName,
        planName: plan?.name || planName,
        planDisplayName: plan?.displayName || planName,
        adminName: form.adminName.trim(),
        adminEmail,
        adminPassword: form.adminPassword,
        loginUrl,
      });

      if (!emailResult.ok) {
        // Account created — show visible error so we can debug, let user continue manually
        console.error('[CreateOrg] Welcome email failed:', emailResult.error);
        setEmailError(emailResult.error ?? 'Unknown email error');
        setPendingSuccessUrl(successUrl);
        setSubmitting(false);
        return;
      }

      // 8. Move to success page
      navigate(successUrl);
    } catch (err: unknown) {
      console.error('[CreateOrg] Failed:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong creating your organization.';
      setError(message);
      setSubmitting(false);
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
          <div className="nav-logo-icon"><Box size={20} /></div>
          Asset Tracker
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="auth-top-bar-link" onClick={() => navigate('/signup')}>
            <ArrowLeft size={16} /> Back to plans
          </button>
        </div>
      </div>

      <div className="auth-shell">
        <div className="auth-shell-bg" />
        <div className="auth-shell-grid" />
        <div className="auth-shell-shapes">
          <ElegantShape delay={0.2} width={520} height={120} rotate={12} gradient="rgba(139, 92, 246, 0.15)" className="shape-1" />
          <ElegantShape delay={0.4} width={420} height={100} rotate={-15} gradient="rgba(244, 63, 94, 0.1)" className="shape-2" />
        </div>

        <motion.div
          className="signup-form-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="signup-header" style={{ marginBottom: 32 }}>
            <div className="signup-selected-plan-pill">
              <Building2 size={14} />
              {plan?.displayName || planName} · {billingCycle}
              <button type="button" onClick={() => navigate('/signup')}>Change</button>
            </div>
            <h1 className="signup-header-title">Create your organization</h1>
            <p className="signup-header-sub">
              You'll be the admin for this workspace. We'll email your login details once the
              organization is created.
            </p>
          </div>

          <div className="auth-card">
            {error && (
              <div className="auth-error" style={{ marginBottom: 20 }}>
                <span className="auth-error-dot" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="signup-form-section-title">Organization</div>

              <div className="signup-form-grid">
                <div className="signup-form-full">
                  <label className="auth-label">Organization name *</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Acme Corporation"
                    value={form.orgName}
                    onChange={update('orgName')}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="auth-label">Short name *</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="ACME"
                    value={form.orgShortName}
                    onChange={update('orgShortName')}
                    required
                    disabled={submitting}
                    maxLength={10}
                  />
                  <div className="signup-hint">Used in your URLs (2–10 chars, letters/numbers/dashes).</div>
                </div>
                <div>
                  <label className="auth-label">Industry</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Technology, Retail, Healthcare..."
                    value={form.industry}
                    onChange={update('industry')}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="auth-label">Country</label>
                  <div ref={countryRef} style={{ position: 'relative' }}>
                    {/* Trigger — becomes an inline search input when open */}
                    <div
                      className="auth-input"
                      onClick={() => { if (!submitting) setCountryOpen(p => !p); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {/* Flag — always visible when a country is selected */}
                      {form.country && !countryOpen && (
                        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                          {SUPPORTED_COUNTRIES.find(c => c.code === form.country)?.flag}
                        </span>
                      )}

                      {countryOpen ? (
                        /* Inline search replaces the label text when open */
                        <input
                          ref={countryInputRef}
                          type="text"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          placeholder={
                            form.country
                              ? SUPPORTED_COUNTRIES.find(c => c.code === form.country)?.name
                              : 'Search countries...'
                          }
                          onClick={e => e.stopPropagation()}
                          style={{
                            flex: 1, border: 'none', outline: 'none',
                            background: 'transparent', fontSize: 'inherit',
                            color: 'inherit', minWidth: 0,
                          }}
                        />
                      ) : (
                        <span style={{ flex: 1, opacity: form.country ? 1 : 0.5 }}>
                          {form.country
                            ? SUPPORTED_COUNTRIES.find(c => c.code === form.country)?.name
                            : 'Select a country'}
                        </span>
                      )}

                      {form.country && !countryOpen && (
                        <span style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>
                          {SUPPORTED_COUNTRIES.find(c => c.code === form.country)?.dialCode}
                        </span>
                      )}
                      <ChevronDown
                        size={16}
                        style={{
                          flexShrink: 0, opacity: 0.55,
                          transform: countryOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </div>

                    {/* Dropdown list */}
                    {countryOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        zIndex: 200, borderRadius: 10, overflow: 'hidden',
                        boxShadow: isDark
                          ? '0 8px 32px rgba(0,0,0,0.45)'
                          : '0 8px 32px rgba(0,0,0,0.14)',
                        border: isDark
                          ? '1px solid rgba(139,92,246,0.28)'
                          : '1px solid rgba(139,92,246,0.3)',
                        background: isDark ? '#1e1b38' : '#ffffff',
                        color: isDark ? '#e2e8f0' : '#1a1a2e',
                      }}>
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {SUPPORTED_COUNTRIES
                            .filter(c =>
                              c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                              c.dialCode.includes(countrySearch)
                            )
                            .map(c => {
                              const isSelected = form.country === c.code;
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => handleCountrySelect(c.code)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '9px 14px', border: 'none',
                                    background: isSelected
                                      ? 'rgba(139,92,246,0.15)'
                                      : 'transparent',
                                    cursor: 'pointer', textAlign: 'left', fontSize: 14,
                                    color: 'inherit', transition: 'background 0.12s',
                                  }}
                                  onMouseEnter={e => {
                                    if (!isSelected)
                                      (e.currentTarget as HTMLButtonElement).style.background =
                                        isDark ? 'rgba(255,255,255,0.07)' : 'rgba(139,92,246,0.07)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isSelected)
                                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                  }}
                                >
                                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                                  <span style={{ flex: 1 }}>{c.name}</span>
                                  <span style={{ fontSize: 12, opacity: 0.5 }}>{c.dialCode}</span>
                                </button>
                              );
                            })}
                          {SUPPORTED_COUNTRIES.filter(c =>
                            c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                            c.dialCode.includes(countrySearch)
                          ).length === 0 && (
                            <div style={{ padding: '12px 14px', opacity: 0.5, fontSize: 13 }}>
                              No countries found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="signup-hint">Auto-sets currency and phone dial code.</div>
                </div>
                <div>
                  <label className="auth-label">Currency</label>
                  <select
                    className="auth-input"
                    value={form.currency}
                    onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                    disabled={submitting}
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <div className="signup-hint">
                    {plan
                      ? (() => {
                          const basePrice = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
                          const perLabel = billingCycle === 'monthly' ? '/mo' : '/yr';
                          if (basePrice === 0) return 'Free plan · no charge';
                          const converted = basePrice * (CURRENCY_RATES[form.currency] ?? 1);
                          return `~ ${formatCurrency(converted, form.currency)} ${perLabel}`;
                        })()
                      : 'Can be changed independently if needed.'}
                  </div>
                </div>
              </div>

              <div className="signup-form-section-title">Admin Account</div>

              <div className="signup-form-grid">
                <div className="signup-form-full">
                  <label className="auth-label">Your full name *</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Jane Doe"
                    value={form.adminName}
                    onChange={update('adminName')}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="auth-label">Work email *</label>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="jane@acme.com"
                    value={form.adminEmail}
                    onChange={update('adminEmail')}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="auth-label">Phone</label>
                  <input
                    className="auth-input"
                    type="tel"
                    placeholder={
                      form.country
                        ? `${SUPPORTED_COUNTRIES.find(c => c.code === form.country)?.dialCode ?? ''} ...`
                        : '+1 555 0100'
                    }
                    value={form.adminPhone}
                    onChange={update('adminPhone')}
                    disabled={submitting}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <label className="auth-label">Password *</label>
                  <div className="auth-input-wrapper">
                    <input
                      className="auth-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={form.adminPassword}
                      onChange={update('adminPassword')}
                      required
                      disabled={submitting}
                      style={{ paddingRight: 46 }}
                      onFocus={() => {
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        if (!suggestedPwd) setSuggestedPwd(generateStrongPassword());
                        setShowSuggestion(true);
                      }}
                      onBlur={() => {
                        blurTimer.current = setTimeout(() => setShowSuggestion(false), 150);
                      }}
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
                  {showSuggestion && (
                    <div
                      className="signup-pwd-suggestion"
                      onMouseDown={e => e.preventDefault()}
                    >
                      <div className="signup-pwd-suggestion-label">Suggested strong password</div>
                      <div className="signup-pwd-suggestion-value">{suggestedPwd}</div>
                      <button
                        type="button"
                        className="signup-pwd-suggestion-use"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            adminPassword: suggestedPwd,
                            adminPasswordConfirm: suggestedPwd,
                          }));
                          setShowPassword(true);
                          setShowSuggestion(false);
                        }}
                      >
                        Use this password
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="auth-label">Confirm password *</label>
                  <input
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={form.adminPasswordConfirm}
                    onChange={update('adminPasswordConfirm')}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="auth-submit-btn"
              >
                {submitting ? (
                  <>
                    <span className="spinner-sm" />
                    Creating your organization...
                  </>
                ) : (
                  <>Create Organization <ArrowRight size={18} style={{ marginLeft: 6 }} /></>
                )}
              </button>

              {emailError && pendingSuccessUrl && (
                <div style={{
                  marginTop: 16, padding: '14px 16px', borderRadius: 10,
                  background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e',
                }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>
                    ⚠ Account created, but welcome email failed to send.
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 12, wordBreak: 'break-all' }}>
                    Error: {emailError}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(pendingSuccessUrl)}
                    style={{
                      padding: '8px 18px', borderRadius: 7, border: 'none',
                      background: '#f59e0b', color: '#fff', fontWeight: 600,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Continue to your workspace →
                  </button>
                </div>
              )}
            </form>

            <p className="auth-footnote">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
