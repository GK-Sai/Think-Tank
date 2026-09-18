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

  /* The arrow belongs on the heading's row, and the heading lives inside the
     component below — so it is handed down rather than rendered out here. */
  const back = <BackLink to="/" label="Back to Dashboard" />;

  return (
    <>
      {isChair
        ? <AdminTaskOverview onViewTask={setViewTask} back={back} />
        : <MyTasksCalendar onViewTask={setViewTask} back={back} />}
      <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} />
    </>
  );
}
