/* Constants the sign-in form still needs. Account checking now happens
   server-side — see POST /api/auth/login. */

export const MIN_PW_LENGTH = 2;
export const REMEMBER_KEY = 'ttRememberedEmail';

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/** Usernames shown in the "Demo accounts" drawer. Delete once real accounts exist. */
export const DEMO_USERNAMES = [
  'priya', 'meera', 'ananya', 'rohit', 'sana', 'vikram', 'karthik',
];

/** Shown beside the team usernames in the demo drawer. */
export const DEMO_TEAM_PASSWORD = 'tt123';
export const DEMO_CHAIR = { username: 'chairman', password: 'gk' };
