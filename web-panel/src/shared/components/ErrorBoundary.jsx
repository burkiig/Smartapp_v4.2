import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#ef4444',
            marginBottom: '1rem',
          }}>!</div>
          <h2 style={{ color: '#1E293B', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
            Beklenmeyen Bir Hata Oluştu
          </h2>
          <p style={{ color: '#64748B', marginBottom: '1.5rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'Bir şeyler ters gitti. Sayfayı yenileyerek tekrar deneyin.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#A855F7',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
