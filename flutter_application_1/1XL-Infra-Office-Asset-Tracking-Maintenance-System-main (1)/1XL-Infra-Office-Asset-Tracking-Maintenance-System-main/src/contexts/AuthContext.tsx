import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Organization } from '../types';
import { supabase, supabaseMissing } from '../lib/supabase';
import { objectToCamel, arrayToCamel } from '../lib/caseMapper';

const LS_SESSION = 'oatms_currentUser';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
  authLoading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isGlobalAdmin: boolean;
  organization: Organization | null;
  organizations: Organization[];
  updateOrganization: (updates: Partial<Organization>) => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);

  const isGlobalAdmin = !!user?.isGlobalAdmin;

  // Fetch all organizations from Supabase on mount
  useEffect(() => {
    supabase.from('organizations').select('*').order('created_at').then(({ data }) => {
      if (data) {
        const orgs = arrayToCamel<Organization>(data);
        setOrganizations(orgs);
      }
    });
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem(LS_SESSION);
    if (storedUserId) {
      supabase
        .from('users')
        .select('*')
        .eq('id', storedUserId)
        .single()
        .then(({ data }) => {
          if (data) {
            const u = objectToCamel<User>(data);
            if (u.isActive) setUser(u);
          }
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Derive organization from user.organizationId
  // Super admin has NO organization — they use the platform admin console
  useEffect(() => {
    if (user && organizations.length > 0) {
      if (user.isGlobalAdmin) {
        // Super admin is isolated from org data
        setOrganization(null);
      } else {
        // Regular user — derive from their organizationId
        const userOrg = organizations.find(o => o.id === user.organizationId) || null;
        setOrganization(userOrg);
      }
    } else {
      setOrganization(null);
    }
  }, [user, organizations]);

  const login = useCallback(async (username: string, password: string): Promise<User | null> => {
    if (supabaseMissing) throw new Error('Database not configured. Set Supabase environment variables.');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', username)
      .eq('password', password)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const found = objectToCamel<User>(data);
    setUser(found);
    localStorage.setItem(LS_SESSION, found.id);
    return found;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setOrganization(null);
    localStorage.removeItem(LS_SESSION);
  }, []);

  const updateOrganization = useCallback((updates: Partial<Organization>) => {
    if (organization) {
      const updated = { ...organization, ...updates };
      setOrganization(updated);
      setOrganizations(prev => prev.map(o => o.id === organization.id ? { ...o, ...updates } : o));
    }
  }, [organization]);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  }, [user]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    // Super admin does NOT get org-level role access — they are platform-only
    if (user.isGlobalAdmin) return false;
    return roles.includes(user.role);
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="w-10 h-10 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, authLoading, hasRole, isGlobalAdmin, organization, organizations, updateOrganization, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
