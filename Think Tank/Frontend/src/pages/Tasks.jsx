import { useState } from 'react';
import AdminTaskOverview from '../components/tasks/AdminTaskOverview';
import MyTasksCalendar from '../components/tasks/MyTasksCalendar';
import TaskViewModal from '../components/tasks/TaskViewModal';
import BackLink from '../components/layout/BackLink';
import { useAuth } from '../store/AuthContext';

/** The chairman gets the org-wide table; a member gets their own calendar. */
export default function Tasks() {
  const { isChair } = useAuth();
  const [viewTask, setViewTask] = useState(null);

  return (
    <>
      <BackLink to="/" label="Back to Dashboard" />
      {isChair
        ? <AdminTaskOverview onViewTask={setViewTask} />
        : <MyTasksCalendar onViewTask={setViewTask} />}
      <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} />
    </>
  );
}
