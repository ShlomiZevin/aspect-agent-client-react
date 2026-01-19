import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.25rem', marginBottom: '2rem', color: '#666' }}>
        Page not found
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link
          to="/aspect"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Go to Aspect
        </Link>
        <Link
          to="/freeda"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#d97398',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Go to Freeda
        </Link>
      </div>
    </div>
  );
}
