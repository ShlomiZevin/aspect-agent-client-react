/**
 * Resolves an /apps/:appId that is not a registry module: a custom screen.
 *
 * Status decides the surface — draft/ready open the builder (clicking a
 * draft continues the conversation, owner flow D4), active renders the
 * published page. An unknown id falls back to the shelf, matching the
 * shell's existing behavior for stale bookmarks.
 *
 * THE OWNED-ID RULE (first live-test bug, 2026-09-15): when THIS router's
 * builder creates the draft, the URL swaps /apps/new → /apps/<id> — and the
 * naive resolver refetched, showed a skeleton and REMOUNTED the builder,
 * which read the not-yet-persisted conversation back as empty. To the user
 * that was "Send reloaded the page". A draft this instance created keeps
 * its mounted builder (`ownedId`); both branches render the SAME element
 * position so React updates props instead of remounting, and the builder
 * itself skips reloading a screen it already holds.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ottoService } from '../../../../services/ottoService';
import { OttoBuilder } from './OttoBuilder';
import { CustomScreenPage } from './CustomScreenPage';
import { Skeleton } from '../../Insights/Skeleton';
import { useUserContext } from '../../../../context/UserContext';
import type { OttoScreen } from '../../../../types/otto';

interface Props {
  datasetId: string;
  appId: string;
  baseURL?: string;
  /** Rendered when the id is neither a screen nor anything else — the shelf. */
  fallback: React.ReactNode;
  /** The shell's breadcrumb leaf, forwarded to whichever surface renders. */
  onCrumb?: (crumb: string) => void;
}

export function CustomScreenRouter({ datasetId, appId, baseURL, fallback, onCrumb }: Props) {
  const navigate = useNavigate();
  const { userId } = useUserContext();
  const [screen, setScreen] = useState<OttoScreen | null>(null);
  const [missing, setMissing] = useState(false);
  /** The draft this mounted builder created — never remount over it. */
  const [ownedId, setOwnedId] = useState<string | null>(null);
  /** Bumped to force a refetch of the SAME appId (publish flips its status). */
  const [reloadTick, setReloadTick] = useState(0);
  const loadedFor = useRef<string | null>(null);

  const isNew = appId === 'new';
  const owned = !isNew && appId === ownedId;

  useEffect(() => {
    if (isNew || owned) return;
    const key = `${datasetId}/${appId}/${reloadTick}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setScreen(null);
    setMissing(false);
    ottoService.getScreen(datasetId, appId, userId, baseURL)
      .then(setScreen)
      .catch(() => setMissing(true));
  }, [datasetId, appId, baseURL, userId, isNew, owned, reloadTick]);

  if (isNew || owned || (screen && screen.status !== 'active')) {
    return (
      <OttoBuilder
        datasetId={datasetId}
        screenId={isNew ? null : appId}
        baseURL={baseURL}
        onDraftCreated={id => {
          // Claim BEFORE navigating: the re-render for the new URL must
          // already know this builder owns the draft, or it remounts.
          setOwnedId(id);
          navigate(`/${datasetId}/intelligence/apps/${id}`, { replace: true });
        }}
        onPublished={() => {
          // Same URL, new status — release ownership and refetch so the
          // published page takes over.
          setOwnedId(null);
          setScreen(null);
          setReloadTick(t => t + 1);
        }}
        onExit={() => navigate(`/${datasetId}/intelligence/apps`)}
        onCrumb={onCrumb}
      />
    );
  }

  if (screen?.status === 'active') {
    return (
      <CustomScreenPage
        datasetId={datasetId}
        screenId={appId}
        baseURL={baseURL}
        onCrumb={onCrumb}
        onUnpublished={() => {
          // Same URL, new status — refetch so the builder takes over.
          setScreen(null);
          setReloadTick(t => t + 1);
        }}
      />
    );
  }

  if (missing) return <>{fallback}</>;

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width={220} height={22} radius={6} />
      <Skeleton width={0} height={260} radius={14} />
    </div>
  );
}
