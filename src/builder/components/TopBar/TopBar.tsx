import { Link } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import styles from './TopBar.module.css';

export function TopBar() {
  const { doc, resetDraft } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset draft?',
      message: 'Local changes will be lost. The builder will start from a blank project.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) resetDraft();
  };

  return (
    <>
      <Link to={agent ? `/${agent.slug}/chat` : '/'} className={styles.back} title="Back to chat">
        ←
      </Link>
      <span className={styles.title}>Builder</span>
      <span className={styles.divider}>·</span>
      <span className={styles.subject}>{doc.name}</span>
      <span className={styles.spacer} />
      <button type="button" className={styles.resetBtn} onClick={handleReset}>
        Reset draft
      </button>
      <span className={styles.draftPill}>Draft</span>
    </>
  );
}
