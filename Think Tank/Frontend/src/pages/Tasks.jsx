import { useState } from 'react';
import AdminTaskOverview from '../components/tasks/AdminTaskOverview';
import MyTasksCalendar from '../components/tasks/MyTasksCalendar';
import TaskViewModal from '../components/tasks/TaskViewModal';
import BackLink from '../components/layout/BackLink';
import useCompact from '../lib/useCompact';
import { useAuth } from '../store/AuthContext';

/** The chairman gets the org-wide table; a member gets their own calendar. */
export default function Tasks() {
  const { isChair } = useAuth();
  const compact = useCompact();
  const [viewTask, setViewTask] = useState(null);

  /* On a phone or tablet the arrow belongs on the heading's row, and the
     heading lives inside the component below — so it is handed down rather
     than floated alongside from out here. */
  const back = <BackLink to="/" label="Back to Dashboard" />;

  return (
    <>
      {!compact && back}
      {isChair
        ? <AdminTaskOverview onViewTask={setViewTask} back={compact ? back : null} />
        : <MyTasksCalendar onViewTask={setViewTask} back={compact ? back : null} />}
      <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} />
    </>
  );
}
