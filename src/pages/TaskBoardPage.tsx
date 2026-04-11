import { TaskBoardContent } from '../components/tasks/TaskBoardModal/TaskBoardContent';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './TaskBoardPage.module.css';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <div className={styles.page} dir="ltr">
      <TaskBoardContent
        isActive={true}
        onClose={() => navigate(-1)}
        initialTaskId={taskId ? parseInt(taskId, 10) : undefined}
      />
    </div>
  );
}
