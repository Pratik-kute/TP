import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataProvider } from '../contexts/DataContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import Layout from './Layout';

export default function OrgSlugResolver() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizations, organization, isGlobalAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!orgSlug || organizations.length === 0) return;

    // Super admin should never be here (blocked by OrgProtectedRoute), but just in case
    if (isGlobalAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    const matchedOrg = organizations.find(
      o => o.shortName.toLowerCase() === orgSlug.toLowerCase()
    );

    if (!matchedOrg) {
      // Invalid slug — redirect to the signed-in user's own org only.
      // Never fall back to organizations[0]: that's whichever org was seeded
      // first in the DB and would leak another tenant's slug into the URL.
      if (organization?.shortName) {
        navigate(`/${organization.shortName}/dashboard`, { replace: true });
      }
      // If organization isn't resolved yet, wait — the effect will re-run.
    }
    // If matched, the user's org is already set via AuthContext
  }, [orgSlug, organizations, organization, navigate, isGlobalAdmin]);

  return (
    <DataProvider>
      <SubscriptionProvider>
        <Layout />
      </SubscriptionProvider>
    </DataProvider>
  );
}
