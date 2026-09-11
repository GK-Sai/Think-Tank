/* Every icon used in the app, in one place. All are stroke-based 24x24 SVGs
   that inherit `currentColor`, so they take their colour from the CSS. */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Icon = ({ children, ...rest }) => (
  <svg {...base} {...rest} aria-hidden="true">
    {children}
  </svg>
);

export const MenuIcon = (p) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Icon>
);

export const BellIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icon>
);

export const HomeIcon = (p) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Icon>
);

export const BulbIcon = (p) => (
  <Icon {...p}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </Icon>
);

export const TaskIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="m8 12 2.5 2.5L16 9" />
  </Icon>
);

export const TeamIcon = (p) => (
  <Icon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const LogIcon = (p) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M9 7h7M9 11h5" />
  </Icon>
);

/* The door sits on the right and the arrow leaves through it. In the left
   sidebar that reads as "on your way out"; the mirrored version pointed the
   arrow back into the app, which is the sign-in gesture, not sign-out. */
/* The arrow leaves the door, it does not walk into it. Drawn the other way
   round, with the doorway on the right and the arrow pointing back inside,
   this is the icon every product uses for *sign in* — which is a confusing
   thing to offer somebody who is already signed in. */
export const SignOutIcon = (p) => (
  <Icon {...p}>
    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
    <path d="m14 17 5-5-5-5" />
    <path d="M19 12H9" />
  </Icon>
);

export const CheckSquareIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Icon>
);

export const ClockIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const WarnIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

export const CalendarIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
);

export const ChevronDownIcon = (p) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (p) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

/* The open/close control on the sidebar: a panel with its edge marked. */
export const PanelIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);

export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

export const EyeIcon = (p) => (
  <Icon {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
);

export const CloseIcon = (p) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const PlusIcon = (p) => (
  <Icon strokeWidth={3} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const UploadIcon = (p) => (
  <Icon strokeWidth={1.7} {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M12 4v12" />
  </Icon>
);

export const FlowIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <rect x="3" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="9" width="7" height="5" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
    <path d="M10 5.5h2a2 2 0 0 1 2 2v4" />
    <path d="M14 14v3.5a2 2 0 0 1-2 2h-2" />
  </Icon>
);

export const BulletIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const ParagraphIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M13 4v16" />
    <path d="M17 4v16" />
    <path d="M17 4H9a5 5 0 0 0 0 10h4" />
  </Icon>
);

export const SmallTeamIcon = (p) => (
  <Icon {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  </Icon>
);

export const ShareIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M4 14v4.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V14" />
  </Icon>
);

export const ArrowLeftIcon = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Icon>
);

export const FilterIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M3 5h18" />
    <path d="M6.5 12h11" />
    <path d="M10 19h4" />
  </Icon>
);

export const SendIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M21.5 2.5 11 13" />
    <path d="M21.5 2.5 15 21l-4-8-8-4z" />
  </Icon>
);

export const TrashIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7 7.5 20a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1L17.5 7" />
  </Icon>
);

export const HistoryIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 8v4.5l3 1.8" />
  </Icon>
);

/* A closed padlock — used where a page explains that reading is allowed but
   replying is not. */
export const LockIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2.5" />
  </Icon>
);

/* Two people with a plus — assigning work to a person or a department. */
export const AssignIcon = (p) => (
  <Icon strokeWidth={1.9} {...p}>
    <path d="M15.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20" />
    <circle cx="9.2" cy="7.6" r="3.4" />
    <path d="M18.5 8v6M21.5 11h-6" />
  </Icon>
);

/* A printer — the paper going in on top, the sheet coming out at the front. */
export const PrinterIcon = (p) => (
  <Icon {...p}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4.5A1.5 1.5 0 0 1 3 16.5v-5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H18" />
    <rect x="6" y="14" width="12" height="7" rx="1.2" />
  </Icon>
);

/* An arrow into a tray — saving a copy rather than sending one. */
export const DownloadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3v12" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </Icon>
);
