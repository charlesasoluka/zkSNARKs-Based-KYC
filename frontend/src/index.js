import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global styles
const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f8f9fa;
    color: #212529;
    line-height: 1.6;
  }

  #root {
    min-height: 100vh;
  }

  button {
    font-family: inherit;
  }

  a {
    color: #007bff;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          margin: '2rem auto',
          maxWidth: '600px',
          border: '1px solid #f5c6cb'
        }}>
          <h2>Something went wrong</h2>
          <p>The application encountered an error. Please refresh the page and try again.</p>
          {this.state.error && (
            <details style={{ marginTop: '1rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error Details</summary>
              <pre style={{ 
                backgroundColor: '#f1f1f1', 
                padding: '1rem', 
                borderRadius: '4px',
                fontSize: '0.8rem',
                overflow: 'auto'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Check for required browser features
const checkBrowserSupport = () => {
  const unsupportedFeatures = [];

  if (!window.ethereum) {
    unsupportedFeatures.push('MetaMask or Web3 provider');
  }

  if (!window.crypto || !window.crypto.subtle) {
    unsupportedFeatures.push('Web Crypto API');
  }

  if (!window.BigInt) {
    unsupportedFeatures.push('BigInt support');
  }

  return unsupportedFeatures;
};

// Main app initialization
const initializeApp = () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  const unsupportedFeatures = checkBrowserSupport();
  
  if (unsupportedFeatures.length > 0) {
    root.render(
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#fff3cd',
        color: '#856404',
        borderRadius: '8px',
        margin: '2rem auto',
        maxWidth: '600px',
        border: '1px solid #ffeaa7'
      }}>
        <h2>Browser Not Supported</h2>
        <p>Your browser doesn't support the following required features:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {unsupportedFeatures.map((feature, index) => (
            <li key={index} style={{ margin: '0.5rem 0' }}>• {feature}</li>
          ))}
        </ul>
        <p style={{ marginTop: '1rem' }}>
          Please use a modern browser like Chrome, Firefox, or Safari with MetaMask installed.
        </p>
      </div>
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Handle document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Optionally show user-friendly error message
});

// Performance monitoring (development only)
if (process.env.NODE_ENV === 'development') {
  const startTime = performance.now();
  
  window.addEventListener('load', () => {
    const loadTime = performance.now() - startTime;
    console.log(`App loaded in ${loadTime.toFixed(2)}ms`);
  });
}