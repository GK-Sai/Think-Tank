import { TODAY, ymd } from '../lib/date';

export const DEPARTMENTS = [
  'I.T Department',
  'Loans',
  'Insurance',
  'Deposits',
  'Recovery',
  'Accounts',
  'Marketing',
  'Sales',
  'Operations',
  'HR',
  'Legal',
  'Admin',
];

/** The chairman's own department is not something you assign work to,
    so it only appears in the member forms. */
export const ALL_DEPARTMENTS = DEPARTMENTS.concat(['Executive']);

/** A sensible Category/Tag per department, applied when an idea is created. */
export const DEPT_TAG = {
  'I.T Department': 'Technology',
  Loans: 'Lending',
  Insurance: 'Risk',
  Deposits: 'Deposits',
  Recovery: 'Collections',
  Accounts: 'Cost Saving',
  Marketing: 'Marketing',
  Sales: 'Market Expansion',
  Operations: 'Process',
  HR: 'People',
  Legal: 'Compliance',
  Admin: 'Administration',
};

export const DESCRIPTION_TYPES = [
  { key: 'flowchart', label: 'Flowchart' },
  { key: 'bulletPoints', label: 'Bullet Points' },
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'uploadFile', label: 'Upload File' },
];

/** An empty description bucket. All four types live side by side, so switching
    tabs never destroys what was typed into another one. */
export const emptyDescription = () => ({
  flowchart: { shapes: [], links: [] },
  bulletPoints: [''],
  paragraph: '',
  uploadFile: [],
});

export const blankIdea = (user) => ({
  id: null,
  title: '',
  created: ymd(TODAY),
  dept: '',
  tag: '',
  status: 'Draft',
  owner: user?.name || 'Admin',
  tagline: '',
  purpose: '',
  descriptionType: 'flowchart',
  descriptionContent: emptyDescription(),
});

export const cloneIdea = (i) => JSON.parse(JSON.stringify(i));

/* Kept for reference; the API now assembles ideas server-side. */
const makeIdea = (o) => {
  const content = emptyDescription();
  if (o.paragraph) content.paragraph = o.paragraph;
  if (o.bullets) content.bulletPoints = o.bullets;
  if (o.flowchart) content.flowchart = o.flowchart;
  if (o.files) content.uploadFile = o.files;
  return {
    id: o.id,
    title: o.title,
    created: o.created,
    dept: o.dept,
    tag: o.tag,
    status: o.status || 'Under Review',
    owner: o.owner,
    tagline: o.tagline || '',
    purpose: o.purpose || '',
    descriptionType: o.descriptionType || 'paragraph',
    descriptionContent: content,
  };
};
export { makeIdea };
