import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { SubscriptionPlan, OrganizationSubscription } from '../types';
import { objectToCamel, arrayToCamel } from '../lib/caseMapper';

interface SubscriptionContextType {
  plan: SubscriptionPlan | null;
  subscription: OrganizationSubscription | null;
  loading: boolean;
  canAccess: (feature: keyof SubscriptionPlan) => boolean;
  isWithinLimit: (resource: 'assets' | 'users' | 'locations', currentCount: number) => boolean;
  tierName: string;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Default beginner plan used when no subscription exists
const BEGINNER_DEFAULTS: Partial<SubscriptionPlan> = {
  name: 'beginner',
  displayName: 'Beginner',
  maxAssets: 50,
  maxUsers: 5,
  maxLocations: 1,
  qrBatchLimit: 10,
  hasAuditPage: false,
  hasAdvancedFilters: false,
  hasColumnCustomization: false,
  hasBulkQrExport: false,
  hasDepreciation: false,
  hasReports: false,
  hasDocuments: false,
  hasProcurement: false,
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { organization, isGlobalAdmin } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const orgId = organization?.id;

  useEffect(() => {
    if (!orgId) {
      setPlan(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Fetch the org's subscription
        const { data: subData } = await supabase
          .from('organization_subscriptions')
          .select('*')
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .maybeSingle();

        if (cancelled) return;

        if (subData) {
          const sub = objectToCamel<OrganizationSubscription>(subData);
          setSubscription(sub);

          // Fetch the plan details
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', sub.planId)
            .single();

          if (!cancelled && planData) {
            setPlan(objectToCamel<SubscriptionPlan>(planData));
          }
        } else {
          // No subscription — fetch beginner plan from DB, or use defaults
          const { data: plans } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('name', 'beginner')
            .maybeSingle();

          if (!cancelled) {
            if (plans) {
              setPlan(objectToCamel<SubscriptionPlan>(plans));
            } else {
              setPlan(BEGINNER_DEFAULTS as SubscriptionPlan);
            }
            setSubscription(null);
          }
        }
      } catch (err) {
        console.error('Error loading subscription:', err);
        if (!cancelled) {
          setPlan(BEGINNER_DEFAULTS as SubscriptionPlan);
          setSubscription(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgId]);

  const canAccess = (feature: keyof SubscriptionPlan): boolean => {
    // Global admin bypasses all feature gates
    if (isGlobalAdmin) return true;
    if (!plan) return false;
    return !!plan[feature];
  };

  const isWithinLimit = (resource: 'assets' | 'users' | 'locations', currentCount: number): boolean => {
    if (isGlobalAdmin) return true;
    if (!plan) return false;
    const limitMap = { assets: plan.maxAssets, users: plan.maxUsers, locations: plan.maxLocations };
    const limit = limitMap[resource];
    return limit === -1 || currentCount < limit;
  };

  const tierName = plan?.name || 'beginner';

  return (
    <SubscriptionContext.Provider value={{ plan, subscription, loading, canAccess, isWithinLimit, tierName }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
}
