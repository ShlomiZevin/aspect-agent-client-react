import { TaskBoardContent } from '../components/tasks/TaskBoardModal/TaskBoardContent';
import { useNavigate, useParams } from 'react-router-dom';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      overflow: 'hidden',
    }} dir="ltr">
      <TaskBoardContent
        isActive={true}
        onClose={() => navigate(-1)}
        initialTaskId={taskId ? parseInt(taskId, 10) : undefined}
      />
    </div>
  );
}
