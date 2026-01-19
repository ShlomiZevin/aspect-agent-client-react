import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

export function HomePage() {
  useEffect(() => {
    document.title = 'AI Agents Marketplace';
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>AI Agents Marketplace</h1>
        <p className={styles.subtitle}>Choose an AI assistant to get started</p>
      </header>

      <div className={styles.grid}>
        {/* Aspect Card */}
        <Link to="/aspect" className={styles.card}>
          <div className={styles.cardContent}>
            <img
              src="/img/aspect-logo-regular.png"
              alt="Aspect"
              className={styles.logo}
            />
            <h2>Aspect BI Assistant</h2>
            <p className={styles.description}>
              Your intelligent business intelligence companion. Analyze data,
              get insights, and make informed decisions.
            </p>
            <div className={styles.features}>
              <span className={styles.feature}>📊 Data Analysis</span>
              <span className={styles.feature}>📈 Business Insights</span>
              <span className={styles.feature}>📁 Knowledge Base</span>
            </div>
          </div>
          <span className={styles.arrow}>→</span>
        </Link>

        {/* Freeda Card */}
        <Link to="/freeda" className={styles.card}>
          <div className={styles.cardContent}>
            <img
              src="/img/freeda-logo.png"
              alt="Freeda"
              className={styles.logo}
            />
            <h2>Freeda</h2>
            <p className={styles.description}>
              Your compassionate menopause companion. Get personalized guidance,
              support, and evidence-based information.
            </p>
            <div className={styles.features}>
              <span className={styles.feature}>💚 Personalized Support</span>
              <span className={styles.feature}>📚 Knowledge Base</span>
              <span className={styles.feature}>🌸 Wellness Tips</span>
            </div>
          </div>
          <span className={styles.arrow}>→</span>
        </Link>
      </div>

      <footer className={styles.footer}>
        <p>Powered by advanced AI technology</p>
      </footer>
    </div>
  );
}
