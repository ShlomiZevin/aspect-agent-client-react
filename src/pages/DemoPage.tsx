import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DemoEditor } from '../components/demo';
import { listMockups, deleteMockup } from '../services/demoService';
import type { DemoMockup } from '../types/demo';

// Inline styles for the list page
const listStyles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: '40px 24px',
  } as React.CSSProperties,
  content: {
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1e293b',
  } as React.CSSProperties,
  createButton: {
    padding: '12px 24px',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  } as React.CSSProperties,
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  } as React.CSSProperties,
  cardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '8px',
  } as React.CSSProperties,
  cardMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '12px',
  } as React.CSSProperties,
  cardBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#f1f5f9',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#475569',
  } as React.CSSProperties,
  cardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '16px',
  } as React.CSSProperties,
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: 'white',
    fontSize: '13px',
    fontWeight: '500',
    color: '#475569',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  deleteButton: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    background: '#fef2f2',
    fontSize: '13px',
    fontWeight: '500',
    color: '#dc2626',
    cursor: 'pointer',
  } as React.CSSProperties,
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#64748b',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '8px',
  } as React.CSSProperties,
  emptyText: {
    fontSize: '14px',
    marginBottom: '24px',
  } as React.CSSProperties,
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontSize: '16px',
    color: '#64748b',
  } as React.CSSProperties,
};

function DemoListPage() {
  const navigate = useNavigate();
  const [mockups, setMockups] = useState<DemoMockup[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    loadMockups();
  }, []);

  const loadMockups = async () => {
    try {
      const data = await listMockups();
      setMockups(data);
    } catch (err) {
      console.error('Failed to load mockups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (publicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this mockup?')) return;

    try {
      await deleteMockup(publicId);
      setMockups((prev) => prev.filter((m) => m.publicId !== publicId));
    } catch (err) {
      console.error('Failed to delete mockup:', err);
    }
  };

  const handleCopyLink = (publicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/demo/${publicId}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) {
    return <div style={listStyles.loading}>Loading mockups...</div>;
  }

  return (
    <div style={listStyles.container}>
      <div style={listStyles.content}>
        <div style={listStyles.header}>
          <h1 style={listStyles.title}>Demo Mockups</h1>
          <button
            style={listStyles.createButton}
            onClick={() => navigate('/demo/new/edit')}
          >
            + Create Mockup
          </button>
        </div>

        {mockups.length === 0 ? (
          <div style={listStyles.empty}>
            <div style={listStyles.emptyTitle}>No mockups yet</div>
            <p style={listStyles.emptyText}>
              Create your first demo conversation mockup to get started.
            </p>
            <button
              style={listStyles.createButton}
              onClick={() => navigate('/demo/new/edit')}
            >
              + Create Mockup
            </button>
          </div>
        ) : (
          <div style={listStyles.grid}>
            {mockups.map((mockup) => (
              <div
                key={mockup.publicId}
                style={{
                  ...listStyles.card,
                  ...(hoveredCard === mockup.publicId ? listStyles.cardHover : {}),
                }}
                onMouseEnter={() => setHoveredCard(mockup.publicId)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => navigate(`/demo/${mockup.publicId}/edit`)}
              >
                <div style={listStyles.cardTitle}>{mockup.title}</div>
                <div style={listStyles.cardMeta}>
                  <span>{mockup.messages.length} messages</span>
                  <span>
                    {new Date(mockup.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span style={listStyles.cardBadge}>
                    {mockup.viewMode === 'whatsapp' ? '📱 WhatsApp' : '💬 Regular'}
                  </span>
                  {mockup.config.language === 'he' && (
                    <span style={{ ...listStyles.cardBadge, marginLeft: '8px' }}>
                      עברית
                    </span>
                  )}
                </div>
                <div style={listStyles.cardActions}>
                  <button
                    style={listStyles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/demo/${mockup.publicId}`, '_blank');
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    style={listStyles.actionButton}
                    onClick={(e) => handleCopyLink(mockup.publicId, e)}
                  >
                    🔗 Copy
                  </button>
                  <button
                    style={listStyles.deleteButton}
                    onClick={(e) => handleDelete(mockup.publicId, e)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DemoPage() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();

  // Determine the mode based on URL
  const isEditMode = location.pathname.endsWith('/edit');
  const isEmbedMode = location.pathname.endsWith('/embed');
  const isNewMockup = id === 'new';

  // List page: /demo
  if (!id) {
    return <DemoListPage />;
  }

  // New mockup: /demo/new/edit
  if (isNewMockup && isEditMode) {
    return <DemoEditor />;
  }

  // Edit existing: /demo/:id/edit
  if (isEditMode) {
    return <DemoEditor mockupId={id} />;
  }

  // Embed mode: /demo/:id/embed
  if (isEmbedMode) {
    return <DemoEditor mockupId={id} isEmbed />;
  }

  // View only: /demo/:id
  return <DemoEditor mockupId={id} isViewOnly />;
}
