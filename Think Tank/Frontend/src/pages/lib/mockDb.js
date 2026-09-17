/* ------------------------------------------------------------------
   The demo database.

   Everything the app shows lives here and is persisted to localStorage,
   so the React project runs on its own with `npm run dev` — no server
   needed. When the real backend arrives, set VITE_USE_MOCK=false and
   lib/api.js switches to lib/httpApi.js instead; nothing else changes.

   Every record that represents something happening — an idea, a comment,
   a revision, a task, a notification — carries an `at` timestamp rather
   than a bare date, so the app can print the real hour it happened.
------------------------------------------------------------------ */

import { safeLocal } from './storage';
import { TODAY, ymd, addDays, dayOffset, stampOffset } from './date';

/* Bump this whenever the seed below changes shape or content — an old
   database sitting in someone's localStorage is then ignored rather than
   quietly serving yesterday's accounts. */
const KEY = 'thinktank.db.v9';

/* ---------------- accounts ----------------
   These are exactly the credentials the sign-in screen advertises:
   the chairman is `chairman` / `gk`, every team member uses `tt123`.

   `name` is what the record holds; `role` is what the app enforces. The
   chairman's personal name is never rendered — displayName() in
   lib/format.js substitutes the office (see CHAIR_LABEL). */
/* `lastSeenAt` drives the online / offline dot beside a name. It is stamped
   on every authenticated call, so "online" means "was doing something in this
   app a moment ago" rather than a socket being held open. */
const USERS = [
  { id: 1, username: 'chairman', password: 'gk',    name: 'G. Krishna',    title: 'Chairman',            role: 'chairman', dept: 'Executive',      email: 'chairman@thinktank.co', av: ['male', 3] },
  { id: 2, username: 'priya',    password: 'tt123', name: 'Priya Iyer',    title: 'Head of Finance',     role: 'member',   dept: 'Accounts',       email: 'priya@thinktank.co',    av: ['female', 0] },
  { id: 3, username: 'meera',    password: 'tt123', name: 'Meera Nair',    title: 'Operations Lead',     role: 'member',   dept: 'Operations',     email: 'meera@thinktank.co',    av: ['female', 1] },
  { id: 4, username: 'ananya',   password: 'tt123', name: 'Ananya Rao',    title: 'Engineering Manager', role: 'member',   dept: 'I.T Department', email: 'ananya@thinktank.co',   av: ['female', 2] },
  { id: 5, username: 'rohit',    password: 'tt123', name: 'Rohit Sharma',  title: 'Marketing Lead',      role: 'member',   dept: 'Marketing',      email: 'rohit@thinktank.co',    av: ['male', 4] },
  { id: 6, username: 'sana',     password: 'tt123', name: 'Sana Fatima',   title: 'Product Manager',     role: 'member',   dept: 'I.T Department', email: 'sana@thinktank.co',     av: ['female', 4] },
  { id: 7, username: 'vikram',   password: 'tt123', name: 'Vikram Shetty', title: 'Operations Manager',  role: 'member',   dept: 'Operations',     email: 'vikram@thinktank.co',   av: ['male', 5] },
  { id: 8, username: 'karthik',  password: 'tt123', name: 'Karthik Menon', title: 'HR Business Partner', role: 'member',   dept: 'HR',             email: 'karthik@thinktank.co',  av: ['male', 1] },
];

const emptyContent = () => ({
  flowchart: { shapes: [], links: [] },
  bulletPoints: [''],
  paragraph: '',
  uploadFile: [],
});

const para = (text) => ({ ...emptyContent(), paragraph: text });

/* ---------------- ideas ----------------
   `revisions` is what drives the Created By / Edited By blocks on the
   idea detail page: entry 0 is the original, each edit appends one.

   The chairman names the department when he writes the idea, alongside the
   tagline and the purpose. From then on the discussion is simply open: every
   team member can post on it and edit it, for as long as the idea exists.
   `sharedWith` is the short list of people he hands the project to. */
const seedIdeas = () => [
  {
    id: 101,
    title: 'Enhance User Onboarding with Interactive Tutorials',
    tagline: 'Enhance User Onboarding with Interactive Tutorials',
    sample: true,
    purpose:
      'New joiners drop off in the first week because nothing walks them through the platform. Guided tutorials would close that gap.',
    dept: 'I.T Department',
    tag: 'Technology',
    status: 'Under Review',
    created: dayOffset(-6),
    createdAt: stampOffset(-6, 10, 12),
    updatedAt: stampOffset(-1, 16, 5),
    ownerId: 1,
    sharedWith: [],
    implementationDate: null,
    descriptionType: 'paragraph',
    descriptionContent: para(
      'Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform. These tutorials should be engaging, visually appealing, and provide step-by-step instructions to ensure users can quickly and effectively utilize the platform\u2019s capabilities. Include progress tracking and the ability to revisit tutorials at any time.'
    ),
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-6, 10, 12),
        text: 'Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform, with step-by-step instructions so people can use it properly in their first week.',
        descriptionType: 'paragraph',
        descriptionContent: para('Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform, with step-by-step instructions so people can use it properly in their first week.'),
      },
      {
        /* A team member sharpened the chairman's wording — this is the
           collaborative edit the discussion page is built around. */
        id: 2,
        authorId: 4,
        authorName: 'Ananya Rao',
        at: stampOffset(-4, 15, 20),
        text: 'Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform. These tutorials should be engaging, visually appealing, and provide step-by-step instructions to ensure users can quickly and effectively utilize the platform\u2019s capabilities. Include progress tracking and the ability to revisit tutorials at any time.',
        descriptionType: 'paragraph',
        descriptionContent: para('Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform. These tutorials should be engaging, visually appealing, and provide step-by-step instructions to ensure users can quickly and effectively utilize the platform\u2019s capabilities. Include progress tracking and the ability to revisit tutorials at any time.'),
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 6,
        authorName: 'Sana Fatima',
        at: stampOffset(-5, 11, 48),
        text: 'This is a great idea. Interactive tutorials would lift engagement a lot, especially for the branch staff who only use us twice a week.',
      },
      {
        id: 2,
        authorId: 4,
        authorName: 'Ananya Rao',
        at: stampOffset(-4, 15, 22),
        text: 'I have added progress tracking and the ability to revisit a tutorial to the description \u2014 without those two, people who get interrupted never come back to it.',
      },
      {
        id: 3,
        authorId: 3,
        authorName: 'Meera Nair',
        at: stampOffset(-3, 9, 40),
        text: 'Agreed. We should also consider tooltips for the advanced features, so a new user is not shown everything at once.',
      },
      {
        id: 4,
        authorId: 5,
        authorName: 'Rohit Sharma',
        at: stampOffset(-1, 16, 5),
        text: 'If we record the tutorials as short videos I can reuse them on the customer side too. Same script, two audiences.',
      },
    ],
    activity: [],
  },
  {
    id: 102,
    title: 'Weekend Loan Desk for Small Traders',
    tagline: 'Weekend Loan Desk for Small Traders',
    sample: true,
    purpose: 'Traders cannot visit on weekdays, so applications stall. A Saturday desk would capture that demand.',
    /* Discussion finished: the chairman handed it to Loans and shared it
       with the two people who will run it. */
    dept: 'Loans',
    tag: 'Lending',
    status: 'Approved',
    created: dayOffset(-14),
    createdAt: stampOffset(-14, 9, 25),
    updatedAt: stampOffset(-9, 15, 32),
    ownerId: 1,
    sharedWith: [2, 3],
    implementationDate: dayOffset(21),
    descriptionType: 'bulletPoints',
    descriptionContent: {
      ...emptyContent(),
      bulletPoints: [
        'Open a two-hour Saturday counter at the three busiest branches.',
        'Staff it on rotation so no one works more than one weekend a month.',
        'Pre-approve documents online so the counter visit is signature only.',
        'Review footfall after eight weeks before expanding.',
      ],
    },
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-14, 9, 25),
        text: 'Open a short Saturday counter for small traders at our busiest branches, staffed on rotation, with paperwork pre-approved online.',
        descriptionType: 'paragraph',
        descriptionContent: para('Open a short Saturday counter for small traders at our busiest branches, staffed on rotation, with paperwork pre-approved online.'),
      },
      {
        id: 2,
        authorId: 2,
        authorName: 'Priya Iyer',
        at: stampOffset(-11, 10, 5),
        text: 'Open a two-hour Saturday counter at the three busiest branches, staffed on rotation so no one works more than one weekend a month, with paperwork pre-approved online so the visit is signature only. Review footfall after eight weeks before expanding.',
        descriptionType: 'bulletPoints',
        descriptionContent: {
          ...emptyContent(),
          bulletPoints: [
            'Open a two-hour Saturday counter at the three busiest branches.',
            'Staff it on rotation so no one works more than one weekend a month.',
            'Pre-approve documents online so the counter visit is signature only.',
            'Review footfall after eight weeks before expanding.',
          ],
        },
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 2,
        authorName: 'Priya Iyer',
        at: stampOffset(-11, 10, 8),
        text: 'I have put the rotation rule into the description \u2014 one weekend a month is the most we can ask without paying overtime.',
      },
      {
        id: 2,
        authorId: 7,
        authorName: 'Vikram Shetty',
        at: stampOffset(-10, 12, 30),
        text: 'Kondapur, Ameerpet and Gachibowli are the three with weekend footfall. The others would sit empty.',
      },
      {
        id: 3,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-9, 15, 30),
        text: 'Good. Approved for a pilot at those three. Report footfall after eight weeks.',
      },
    ],
    activity: [],
  },
  {
    id: 103,
    title: 'Recovery Call Scripts by Delinquency Stage',
    tagline: 'Recovery Call Scripts by Delinquency Stage',
    sample: true,
    purpose: 'Every officer improvises. Consistent scripts would lift recovery rates and keep us compliant.',
    dept: 'Recovery',
    tag: 'Collections',
    status: 'In Progress',
    created: dayOffset(-9),
    createdAt: stampOffset(-9, 8, 55),
    updatedAt: stampOffset(-4, 14, 45),
    ownerId: 1,
    sharedWith: [7],
    implementationDate: dayOffset(10),
    descriptionType: 'paragraph',
    descriptionContent: para(
      'Write one approved script per delinquency stage \u2014 15, 30, 60 and 90 days \u2014 with the exact language the regulator expects, an escalation path, and a short list of concessions an officer may offer without approval.'
    ),
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-9, 8, 55),
        text: 'Write one approved script per delinquency stage \u2014 15, 30, 60 and 90 days \u2014 with the exact language the regulator expects and an escalation path.',
        descriptionType: 'paragraph',
        descriptionContent: para('Write one approved script per delinquency stage \u2014 15, 30, 60 and 90 days \u2014 with the exact language the regulator expects and an escalation path.'),
      },
      {
        id: 2,
        authorId: 7,
        authorName: 'Vikram Shetty',
        at: stampOffset(-5, 11, 15),
        text: 'Write one approved script per delinquency stage \u2014 15, 30, 60 and 90 days \u2014 with the exact language the regulator expects, an escalation path, and a short list of concessions an officer may offer without approval.',
        descriptionType: 'paragraph',
        descriptionContent: para('Write one approved script per delinquency stage \u2014 15, 30, 60 and 90 days \u2014 with the exact language the regulator expects, an escalation path, and a short list of concessions an officer may offer without approval.'),
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 7,
        authorName: 'Vikram Shetty',
        at: stampOffset(-5, 11, 18),
        text: 'Added the concessions list \u2014 officers need to know what they can offer without ringing the chairman at nine at night.',
      },
      {
        id: 2,
        authorId: 8,
        authorName: 'Karthik Menon',
        at: stampOffset(-5, 14, 2),
        text: 'Whatever the wording ends up being, we will need a short training session before it goes live.',
      },
      {
        id: 3,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-4, 14, 40),
        text: 'Agreed on both. Vikram, this is yours \u2014 draft the 15 and 30 day scripts first.',
      },
    ],
    activity: [],
  },
  {
    id: 104,
    title: 'Referral Rewards for Existing Depositors',
    tagline: 'Referral Rewards for Existing Depositors',
    sample: true,
    purpose: 'Word of mouth already brings us deposits. Paying for it properly would bring more.',
    /* Raised this morning — the newest thing in the room. */
    dept: 'Marketing',
    tag: 'Marketing',
    status: 'Under Review',
    created: dayOffset(-1),
    createdAt: stampOffset(-1, 17, 8),
    updatedAt: stampOffset(0, 9, 15),
    ownerId: 1,
    sharedWith: [],
    implementationDate: null,
    descriptionType: 'paragraph',
    descriptionContent: para(
      'Give existing depositors a small fixed reward for every referral that opens an account and keeps it funded for ninety days. Track referrals through a code in the mobile app so nothing has to be handled at the branch.'
    ),
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-1, 17, 8),
        text: 'Give existing depositors a small fixed reward for every referral that opens an account and keeps it funded for ninety days. Track referrals through a code in the mobile app so nothing has to be handled at the branch.',
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 5,
        authorName: 'Rohit Sharma',
        at: stampOffset(0, 9, 15),
        text: 'Ninety days funded is the right test \u2014 anything shorter and we pay for accounts that close in a month.',
      },
    ],
    activity: [],
  },
  {
    id: 105,
    title: 'Quarterly Skills Exchange Between Departments',
    tagline: 'Quarterly Skills Exchange Between Departments',
    sample: true,
    purpose: 'Departments solve the same problems twice because nobody talks across the floor.',
    dept: 'HR',
    tag: 'People',
    status: 'On Hold',
    created: dayOffset(-21),
    createdAt: stampOffset(-21, 13, 15),
    updatedAt: stampOffset(-15, 10, 2),
    ownerId: 1,
    sharedWith: [8],
    implementationDate: null,
    descriptionType: 'bulletPoints',
    descriptionContent: {
      ...emptyContent(),
      bulletPoints: [
        'One afternoon a quarter, each department demos what it built.',
        'Twenty minutes per team, no slides longer than five pages.',
        'Rotate the host department so the load is shared.',
      ],
    },
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-21, 13, 15),
        text: 'One afternoon a quarter, each department demos what it built to everyone else. Twenty minutes per team, rotating host.',
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 8,
        authorName: 'Karthik Menon',
        at: stampOffset(-18, 9, 30),
        text: 'Happy to run it, but not while the audit is open \u2014 nobody has an afternoon spare until it closes.',
      },
      {
        id: 2,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-15, 10, 0),
        text: 'Good idea, wrong quarter. HR owns it. Bring it back after the audit closes.',
      },
    ],
    activity: [],
  },
  {
    id: 106,
    title: 'Single Dashboard for Branch Cash Position',
    tagline: 'Single Dashboard for Branch Cash Position',
    sample: true,
    purpose: 'Branch managers phone each other to find cash. One screen would end that.',
    dept: 'Operations',
    tag: 'Process',
    status: 'In Progress',
    created: dayOffset(-11),
    createdAt: stampOffset(-11, 11, 35),
    updatedAt: stampOffset(-10, 11, 40),
    ownerId: 1,
    sharedWith: [3, 4],
    implementationDate: dayOffset(30),
    descriptionType: 'flowchart',
    descriptionContent: {
      ...emptyContent(),
      flowchart: {
        shapes: [
          { id: 1, label: 'Branch enters closing cash', x: 40, y: 40, w: 170, h: 60, type: 'process' },
          { id: 2, label: 'Nightly roll-up job', x: 40, y: 150, w: 170, h: 60, type: 'process' },
          { id: 3, label: 'Regional dashboard', x: 40, y: 260, w: 170, h: 60, type: 'process' },
        ],
        /* The last step goes back to the first — a return arrow, which is
           routed round the side rather than back up through the steps. */
        links: [
          { from: 1, to: 2 },
          { from: 2, to: 3 },
          { from: 3, to: 1, back: true },
        ],
      },
    },
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-11, 11, 35),
        text: 'Every branch posts its closing cash position; a nightly job rolls it up into one regional dashboard managers can read before they open.',
      },
    ],
    comments: [
      {
        id: 1,
        authorId: 3,
        authorName: 'Meera Nair',
        at: stampOffset(-11, 14, 10),
        text: 'Every branch can post a closing figure by seven. Earlier than that and the last counter is still open.',
      },
      {
        id: 2,
        authorId: 4,
        authorName: 'Ananya Rao',
        at: stampOffset(-10, 10, 5),
        text: 'A nightly job is easy. The work is getting the branch systems to agree on what "closing" means.',
      },
    ],
    activity: [],
  },
  {
    id: 107,
    title: 'Digitise the Insurance Claim Intake Form',
    tagline: 'Digitise the Insurance Claim Intake Form',
    sample: true,
    purpose: 'Paper intake adds four days to every claim before anyone even reads it.',
    /* A private draft: not opened for discussion, so nobody has been told. */
    dept: 'Insurance',
    tag: 'Risk',
    status: 'Draft',
    created: dayOffset(-1),
    createdAt: stampOffset(-1, 18, 22),
    updatedAt: stampOffset(-1, 18, 22),
    ownerId: 1,
    sharedWith: [],
    implementationDate: null,
    descriptionType: 'paragraph',
    descriptionContent: para(
      'Replace the paper claim intake form with a mobile form the branch officer fills in with the customer present, attaching photographs of documents directly instead of couriering them.'
    ),
    revisions: [
      {
        id: 1,
        authorId: 1,
        authorName: 'G. Krishna',
        at: stampOffset(-1, 18, 22),
        text: 'Replace the paper claim intake form with a mobile form the branch officer fills in with the customer present, attaching photographs of documents directly instead of couriering them.',
      },
    ],
    comments: [],
    activity: [],
  },
];

/* ---------------- tasks ----------------
   Each task's department follows its owner, the way the API will set it.
   `at` is when the task was assigned; `start` is where it sits on the
   calendar. Both are real timestamps — nothing is a hard-coded hour. */
const seedTasks = () => [
  { id: 201, title: 'Draft onboarding tutorial storyboard', description: 'Six screens covering sign-in, ideas, tasks and the think log.', dept: 'I.T Department', ownerId: 4, assignedById: 1, ideaId: 101, at: stampOffset(-2, 10, 0),  start: stampOffset(3, 10, 0),   due: dayOffset(3),   status: 'In Progress', priority: 'High' },
  { id: 202, title: 'Weekend desk staffing rota', description: 'Draw up the eight-week rotation and circulate for objections.', dept: 'Accounts', ownerId: 2, assignedById: 1, ideaId: 102, at: stampOffset(-1, 9, 30),  start: stampOffset(1, 9, 30),   due: dayOffset(1),   status: 'In Progress', priority: 'High' },
  { id: 203, title: 'Write the 15-day recovery script', description: 'First of four; run the wording past Legal before sending.', dept: 'Operations', ownerId: 7, assignedById: 1, ideaId: 103, at: stampOffset(-4, 14, 0),  start: stampOffset(-1, 14, 0),  due: dayOffset(-1),  status: 'In Progress', priority: 'High' },
  { id: 204, title: 'Referral reward cost model', description: 'What a fixed reward costs us per funded account at three volumes.', dept: 'Marketing', ownerId: 5, assignedById: 1, ideaId: 104, at: stampOffset(0, 11, 15),  start: stampOffset(5, 11, 15),  due: dayOffset(5),   status: 'In Progress', priority: 'Medium' },
  { id: 205, title: 'Collect branch cash feeds', description: 'Confirm every branch can post a closing figure by 7pm.', dept: 'Operations', ownerId: 3, assignedById: 1, ideaId: 106, at: stampOffset(-6, 16, 0),  start: stampOffset(-3, 16, 0),  due: dayOffset(-3),  status: 'Completed', priority: 'Medium' },
  { id: 206, title: 'Quarterly exchange venue hold', description: 'Hold the training room for the first Friday of each quarter.', dept: 'HR', ownerId: 8, assignedById: 1, ideaId: 105, at: stampOffset(-8, 13, 0),  start: stampOffset(-5, 13, 0),  due: dayOffset(-5),  status: 'Completed', priority: 'Low' },
  { id: 207, title: 'Claim form field audit', description: 'List every field on the paper form and mark what is actually used.', dept: 'I.T Department', ownerId: 6, assignedById: 1, ideaId: 107, at: stampOffset(1, 10, 30),  start: stampOffset(7, 10, 30),  due: dayOffset(7),   status: 'In Progress', priority: 'Medium' },
  { id: 208, title: 'Tutorial copy review', description: 'Read the tutorial copy for tone and length.', dept: 'Marketing', ownerId: 5, assignedById: 1, ideaId: 101, at: stampOffset(2, 15, 30),  start: stampOffset(9, 15, 30),  due: dayOffset(9),   status: 'In Progress', priority: 'Low' },
  { id: 209, title: 'Recovery dashboard walkthrough', description: 'Show the recovery team the new reporting screen.', dept: 'Operations', ownerId: 7, assignedById: 1, ideaId: null, at: stampOffset(-12, 11, 0), start: stampOffset(-9, 11, 0),  due: dayOffset(-9),  status: 'Completed', priority: 'Medium' },
  { id: 210, title: 'Re-check deposit slab pricing', description: 'Returned for a second pass on the six-month slab.', dept: 'Accounts', ownerId: 2, assignedById: 1, ideaId: null, at: stampOffset(-3, 9, 0),   start: stampOffset(2, 9, 0),    due: dayOffset(2),   status: 'Re Assign', priority: 'High' },
  { id: 211, title: 'Branch manager training slots', description: 'Two sessions per region, ninety minutes each.', dept: 'Operations', ownerId: 3, assignedById: 1, ideaId: 106, at: stampOffset(4, 14, 30),  start: stampOffset(12, 14, 30), due: dayOffset(12),  status: 'In Progress', priority: 'Medium' },
  { id: 212, title: 'Review the concession list', description: 'Confirm what officers may offer without approval.', dept: 'HR', ownerId: 8, assignedById: 1, ideaId: 103, at: stampOffset(3, 12, 0),   start: stampOffset(6, 12, 0),   due: dayOffset(6),   status: 'In Progress', priority: 'High' },
  { id: 213, title: 'Onboarding tutorial build — sprint 1', description: 'Sign-in and ideas board walkthroughs.', dept: 'I.T Department', ownerId: 4, assignedById: 1, ideaId: 101, at: stampOffset(5, 10, 0),  start: stampOffset(14, 10, 0),  due: dayOffset(14),  status: 'In Progress', priority: 'High' },
  { id: 214, title: 'Product spec for the mobile claim form', description: 'Field list, validation rules and offline behaviour.', dept: 'I.T Department', ownerId: 6, assignedById: 1, ideaId: 107, at: stampOffset(-5, 14, 0), start: stampOffset(4, 14, 0),   due: dayOffset(4),   status: 'In Progress', priority: 'Medium' },
];

/* ---------------- think logs ----------------
   The think log is a private page, so these belong to the chairman. */
const seedLogs = () => [
  {
    id: 301,
    ownerId: 1,
    date: dayOffset(0),
    at: stampOffset(0, 8, 40),
    sample: true,
    title: 'Onboarding drop-off is a first-week problem, not a product problem',
    /* A note is one point, however many lines it runs to. */
    points: [{
      id: 1,
      state: 'idea',
      text: 'Onboarding drop-off is a first-week problem, not a product problem.\nAsk Ananya for the seven-day retention numbers by department.',
    }],
  },
  {
    id: 302,
    ownerId: 1,
    date: dayOffset(-1),
    at: stampOffset(-1, 8, 15),
    sample: true,
    title: 'Saturday footfall at the Kondapur branch is double the weekday average',
    points: [{
      id: 2,
      state: 'idea',
      text: 'Saturday footfall at the Kondapur branch is double the weekday average.\nRecovery officers each use different language on the same call.',
    }],
  },
  {
    id: 303,
    ownerId: 1,
    date: dayOffset(-4),
    at: stampOffset(-4, 9, 5),
    sample: true,
    title: 'Referrals already bring in a third of new deposits with no incentive at all',
    points: [{
      id: 3,
      state: 'task',
      text: 'Referrals already bring in a third of new deposits with no incentive at all.\nDraft a note to Rohit about referral tracking in the app.',
    }],
  },
  {
    id: 304,
    ownerId: 1,
    date: dayOffset(-12),
    at: stampOffset(-12, 7, 50),
    sample: true,
    title: 'Departments are solving the same reporting problem three times over',
    points: [{
      id: 4,
      state: null,
      text: 'Departments are solving the same reporting problem three times over.\nAudit closes end of next month — nothing new before then.',
    }],
  },
];

/* ---------------- notifications ----------------
   `at` is the moment the thing happened. The heading it sits under and the
   "Today, 10:04 AM" line are both derived from it, so nothing has to be
   relabelled as the day rolls over. */
const seedNotifs = () => {
  const rows = [];
  let id = 400;
  const add = (userId, icon, title, at, extra = {}) => {
    rows.push({ id: (id += 1), userId, icon, title, at, unread: true, reminder: false, ...extra });
  };

  /* The newest idea went to everybody — that is the whole point of the
     chairman opening a discussion. One line, eight recipients. */
  const everyone = [1, 2, 3, 4, 5, 6, 7, 8];
  everyone.filter((u) => u !== 1).forEach((u) => {
    add(u, 'idea', 'New idea: Referral Rewards for Existing Depositors', stampOffset(-1, 17, 8), { link: '/ideas/104' });
  });

  /* What the chairman sees. Deliberately short: a bell that pings on every
     edit and every comment is a bell nobody reads. */
  add(1, 'warn', 'Task overdue: Write the 15-day recovery script', stampOffset(0, 7, 0), { reminder: true, link: '/tasks' });

  /* What a member sees: work addressed to them, and nothing else. */
  add(4, 'task', 'New task: Onboarding tutorial build — sprint 1', stampOffset(0, 9, 12), { link: '/tasks' });
  add(4, 'snooze', 'Due in 3 days: onboarding storyboard', stampOffset(-1, 9, 0), { unread: false, reminder: true, link: '/tasks' });
  add(4, 'ok', 'Shared with you: Single Dashboard for Branch Cash…', stampOffset(-10, 11, 40), { unread: false, link: '/ideas/106' });

  add(2, 'ok', 'Shared with you: Weekend Loan Desk for Small Tra…', stampOffset(-9, 15, 32), { link: '/ideas/102' });
  add(7, 'ok', 'Shared with you: Recovery Call Scripts by Delinq…', stampOffset(-4, 14, 45), { link: '/ideas/103' });

  return rows;
};

/* ---------------- direct messages ----------------
   One row per pair of people, so a thread is found by looking for the pair in
   either order. `pair` is sorted, which is what makes that lookup cheap. */
const seedDms = () => [
  {
    id: 601,
    pair: [1, 4],
    messages: [
      { id: 1, fromId: 1, text: 'Can you sit on the onboarding idea? You know the drop-off numbers.', at: stampOffset(-2, 9, 12) },
      { id: 2, fromId: 4, text: 'Yes. I will pull the seven-day retention split by department first.', at: stampOffset(-2, 9, 20) },
    ],
  },
  {
    id: 602,
    pair: [4, 6],
    messages: [
      { id: 3, fromId: 6, text: 'Are we demoing the tutorials at the next review?', at: stampOffset(-1, 15, 2) },
    ],
  },
];

const freshDb = () => ({
  users: USERS,
  dms: seedDms(),
  ideas: seedIdeas(),
  tasks: seedTasks(),
  logs: seedLogs(),
  notifs: seedNotifs(),
  seq: { idea: 200, task: 300, log: 400, notif: 500, user: 100, comment: 1000, revision: 1000, dm: 700, dmMsg: 2000 },
  sessionUserId: null,
  seededOn: ymd(TODAY),
});

/* ------------------------------------------------------------------
   Load / save.

   The seed runs once, on the very first visit. What is in storage after that
   is kept, whatever day it is.

   An earlier version re-seeded whenever the date changed, so that the demo's
   relative dates stayed fresh. That was the wrong trade: it also threw away
   every idea, message and read notification from the day before — so you
   could mark everything as read, come back the next morning, and find the
   whole list unread again with your own work gone. Slightly stale sample
   dates are a far smaller problem than losing what somebody actually did.
------------------------------------------------------------------ */
let db = null;

function load() {
  if (db) return db;
  try {
    const raw = safeLocal.get(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users) { db = parsed; return db; }
    }
  } catch { /* corrupt or unavailable storage — start clean */ }
  db = freshDb();
  save();
  return db;
}

function save() {
  try { safeLocal.set(KEY, JSON.stringify(db)); } catch { /* memory only */ }
}

/** Drop the in-memory copy so the next read picks up what another tab wrote.
    This is what makes a notification raised in the chairman's tab appear in
    the tab a team member is signed into. */
function reload() {
  db = null;
  return load();
}

const nextId = (kind) => {
  const d = load();
  d.seq[kind] += 1;
  return d.seq[kind];
};

export const resetDb = () => { db = freshDb(); save(); return db; };

export { load as getDb, save as saveDb, reload as reloadDb, nextId, USERS, addDays, TODAY, KEY as DB_KEY };
