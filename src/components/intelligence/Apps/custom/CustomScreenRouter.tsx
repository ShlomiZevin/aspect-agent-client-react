/**
 * Resolves an /apps/:appId that is not a registry module: a custom screen.
 *
 * Status decides the surface — draft/ready open the builder (clicking a
 * draft continues the conversation, owner flow D4), active renders the
 * published page. An unknown id falls back to the shelf, matching the
 * shell's existing behavior for stale bookmarks.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ottoService } from '../../../../services/ottoService';
import { OttoBuilder } from './OttoBuilder';
import { CustomScreenPage } from './CustomScreenPage';
import { Skeleton } from '../../Insights/Skeleton';
import type { OttoScreen } from '../../../../types/otto';

interface Props {
  datasetId: string;
  appId: string;
  baseURL?: string;
  /** Rendered when the id is neither a screen nor anything else — the shelf. */
  fallback: React.ReactNode;
}

export function CustomScreenRouter({ datasetId, appId, baseURL, fallback }: Props) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<OttoScreen | null>(null);
  const [missing, setMissing] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const isNew = appId === 'new';

  useEffect(() => {
    if (isNew) return;
    const key = `${datasetId}/${appId}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setScreen(null);
    setMissing(false);
    ottoService.getScreen(datasetId, appId, baseURL)
      .then(setScreen)
      .catch(() => setMissing(true));
  }, [datasetId, appId, baseURL, isNew]);

  if (isNew || (screen && screen.status !== 'active')) {
    return (
      <OttoBuilder
        datasetId={datasetId}
        screenId={isNew ? null : appId}
        baseURL={baseURL}
        onDraftCreated={id => navigate(`/intelligence/${datasetId}/apps/${id}`, { replace: true })}
        onPublished={id => {
          // A published screen renders through CustomScreenPage — same URL,
          // fresh resolution.
          loadedFor.current = null;
          navigate(`/intelligence/${datasetId}/apps/${id}`, { replace: true });
          setScreen(s => (s ? { ...s, status: 'active' } : s));
        }}
        onExit={() => navigate(`/intelligence/${datasetId}/apps`)}
      />
    );
  }

  if (screen?.status === 'active') {
    return <CustomScreenPage datasetId={datasetId} screenId={appId} baseURL={baseURL} />;
  }

  if (missing) return <>{fallback}</>;

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width={220} height={22} radius={6} />
      <Skeleton width={0} height={260} radius={14} />
    </div>
  );
}
