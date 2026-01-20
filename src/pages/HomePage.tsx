import { useEffect } from 'react';
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

      <footer className={styles.footer}>
        <p>Powered by advanced AI technology</p>
      </footer>
    </div>
  );
}
