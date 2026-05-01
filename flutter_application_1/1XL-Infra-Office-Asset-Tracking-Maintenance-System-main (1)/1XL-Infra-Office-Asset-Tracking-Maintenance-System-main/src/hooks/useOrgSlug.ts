import { useParams } from 'react-router-dom';

export function useOrgSlug(): string {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return orgSlug || '';
}
