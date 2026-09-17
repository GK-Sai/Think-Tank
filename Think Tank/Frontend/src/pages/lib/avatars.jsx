/* Cartoon avatars, drawn as inline SVG so there are no image assets to ship.

   Twelve variants per sex. The variant index picks a whole look — skin, hair
   colour, hairstyle, shirt, backdrop, and whether the character wears glasses
   or a beard — rather than only recolouring one face, so a table of people
   reads as a table of people.

   They blink. The animation is pure CSS (see `.av-*` in styles/global.css),
   staggered per variant so a room full of them never blinks in unison, and it
   stops for anyone who has asked for reduced motion. */

const SKIN = ['#f7d3b0', '#f0c49a', '#e8b688', '#dda775', '#c08a58', '#a97142',
  '#9a6641', '#8a5a38', '#f3c9a4', '#e5b184', '#cf9663', '#7a4d2e'];

const HAIR = ['#2b1b12', '#4a2c18', '#7b4a22', '#1f1f1f', '#a0522d', '#c9973f',
  '#3d2b1f', '#5b3a1e', '#141414', '#8b5e34', '#6b4423', '#9b8579'];

const SHIRT = ['#1a56db', '#2f9e5e', '#f0932b', '#e05252', '#7c5cd6', '#0ea5a5',
  '#3b6fd4', '#d4557f', '#4d7c2f', '#c2761b', '#5a5fd0', '#128a7d'];

const BG = ['#e8f0ff', '#eaf7ef', '#fdf1e3', '#fdeaea', '#f1ecfd', '#e6f7f7',
  '#eaf1fd', '#fdedf3', '#f0f6e8', '#fdf3e6', '#eeeefc', '#e6f5f2'];

const COUNT = 12;

export const AVATAR_VARIANTS = Array.from({ length: COUNT }, (_, i) => i);

/* Which extras a variant gets. Kept as plain lookups so a variant always
   renders the same person, whatever order the team table is sorted in. */
const HAS_GLASSES = [false, false, true, false, false, true, false, true, false, false, true, false];
const HAS_BEARD = [false, true, false, false, true, false, true, false, false, true, false, true];

/* Hairstyle per variant, per sex. */
const MALE_HAIR = ['crop', 'crop', 'side', 'buzz', 'wave', 'side', 'crop', 'wave', 'buzz', 'side', 'crop', 'wave'];
const FEMALE_HAIR = ['long', 'bun', 'bob', 'long', 'bun', 'bob', 'long', 'bob', 'bun', 'long', 'bob', 'bun'];

/* ---------------- hair shapes ---------------- */

function MaleHair({ style, hair }) {
  if (style === 'buzz') {
    return <path d="M19.5 27.5c0-7.2 5.6-12.6 12.5-12.6s12.5 5.4 12.5 12.6v.4c-2.4-3.6-6.6-5.2-12.5-5.2s-10.1 1.6-12.5 5.2z" fill={hair} />;
  }
  if (style === 'wave') {
    return (
      <path
        d="M19 28.6c-.6-8.4 5.2-14.4 13-14.4 7.4 0 13.2 5.4 13 13.6-1-2.4-2.6-3.4-4-3.2-1.6.2-2.4 1.6-4.6 1.6-2.4 0-3-1.8-5.4-1.8-2.2 0-3 1.6-5 1.8-1.6.2-2.8.6-4 2.4z"
        fill={hair}
      />
    );
  }
  if (style === 'side') {
    return (
      <path
        d="M18.8 28.8C18.2 20.2 24 14.2 32 14.2c7.6 0 13.2 5.6 13.2 13.4-2-4.6-5.4-6.4-9-6.4-3 0-4.4 1-7.2 2.6-2.6 1.5-4.6 2.6-6.2 5z"
        fill={hair}
      />
    );
  }
  return (
    <path
      d="M19 28c0-7.7 5.8-13.6 13-13.6S45 20.3 45 28v.6c-1.9-4.6-5.4-6.6-11-6.6-3.4 0-6.3.6-8.6 2.4-2 1.5-3.4 3.3-4.4 5.2z"
      fill={hair}
    />
  );
}

function FemaleHairBack({ style, hair }) {
  if (style === 'bob') {
    return <path d="M18 30c0-9 6.2-15.5 14-15.5S46 21 46 30v11l-5 1.4V30c0-6-3.8-9.5-9-9.5S23 24 23 30v12.4L18 41z" fill={hair} />;
  }
  if (style === 'bun') {
    return (
      <>
        <circle cx="32" cy="11.5" r="5.6" fill={hair} />
        <path d="M18 31c0-9 6-16 14-16s14 7 14 16v9l-4 1.2V31c0-6-4-9.5-10-9.5S22 25 22 31v10.2L18 40z" fill={hair} />
      </>
    );
  }
  return (
    <path
      d="M17 31c0-9 6-16 15-16s15 7 15 16v16l-4.5 1.5V31c0-6-4-9.5-10.5-9.5S21.5 25 21.5 31v17.5L17 47z"
      fill={hair}
    />
  );
}

/* ---------------- the avatar ---------------- */

export function Avatar({ sex = 'male', variant = 0, className = 'avatar-cell', bare = false, title }) {
  const v = Math.abs(variant | 0) % COUNT;
  const skin = SKIN[v];
  const hair = HAIR[v];
  const shirt = SHIRT[v];
  const bg = BG[v];
  const female = sex === 'female';
  const glasses = HAS_GLASSES[v];
  const beard = !female && HAS_BEARD[v];
  const style = female ? FEMALE_HAIR[v] : MALE_HAIR[v];

  /* Staggering the blink by variant is what stops eight avatars in a table
     from winking at the reader in time with each other. */
  const blinkDelay = `${(v % 6) * 1.1 + 0.4}s`;

  const svg = (
    <svg viewBox="0 0 64 64" role="img" aria-label={title || ''} aria-hidden={title ? undefined : 'true'}>
      <circle cx="32" cy="32" r="32" fill={bg} />

      {/* shoulders and collar */}
      <path d="M6 64c0-12.5 10.5-19.5 26-19.5S58 51.5 58 64z" fill={shirt} className="av-body" />
      <path d="M27 45.5 32 51l5-5.5 2.6 1.2L32 55l-7.6-8.3z" fill="#ffffff" opacity="0.9" />

      {/* neck */}
      <path d="M27 33h10v9.5a5 5 0 0 1-10 0z" fill={skin} />
      <path d="M27 36.5c2.6 2.2 7.4 2.2 10 0V33H27z" fill="#000" opacity="0.08" />

      {female && <FemaleHairBack style={style} hair={hair} />}

      {/* ears */}
      <circle cx="19.6" cy="28.5" r="2.9" fill={skin} />
      <circle cx="44.4" cy="28.5" r="2.9" fill={skin} />

      {/* head */}
      <path d="M32 13.6c7.6 0 13.2 5.8 13.2 13.6v3.2c0 7.9-5.9 13.6-13.2 13.6s-13.2-5.7-13.2-13.6v-3.2c0-7.8 5.6-13.6 13.2-13.6z" fill={skin} />

      {beard && (
        <path
          d="M20.4 29.6c0 9.4 4.6 14.4 11.6 14.4s11.6-5 11.6-14.4c.9 4 1 7.4.4 10.6-1.1 5.6-5.4 8.2-12 8.2s-10.9-2.6-12-8.2c-.6-3.2-.5-6.6.4-10.6z"
          fill={hair}
          opacity="0.92"
        />
      )}

      {female ? (
        <path
          d="M18.6 28.6C18.2 19.9 24.4 13.6 32 13.6s13.8 6.3 13.4 15c-2.4-5.6-6.6-7.8-13.4-7.8s-11 2.2-13.4 7.8z"
          fill={hair}
        />
      ) : (
        <MaleHair style={style} hair={hair} />
      )}

      {/* brows */}
      <path d="M25.6 24.4q2.2-1.2 4.2 0" stroke={hair} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M34.2 24.4q2-1.2 4.2 0" stroke={hair} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.85" />

      {/* eyes — the blink is a scaleY on these two */}
      <g className="av-eyes" style={{ animationDelay: blinkDelay }}>
        <circle cx="27.4" cy="28.6" r="2" fill="#ffffff" />
        <circle cx="36.6" cy="28.6" r="2" fill="#ffffff" />
        <circle cx="27.6" cy="28.8" r="1.5" fill="#33291f" />
        <circle cx="36.8" cy="28.8" r="1.5" fill="#33291f" />
        <circle cx="27.1" cy="28.2" r="0.5" fill="#ffffff" />
        <circle cx="36.3" cy="28.2" r="0.5" fill="#ffffff" />
      </g>

      {glasses && (
        <g stroke="#3c4658" strokeWidth="1.3" fill="none" opacity="0.9">
          <rect x="23.4" y="25.6" width="8" height="6" rx="3" />
          <rect x="32.6" y="25.6" width="8" height="6" rx="3" />
          <path d="M31.4 28.4h1.2M23.4 28.2l-3.2-.6M40.6 28.2l3.2-.6" />
        </g>
      )}

      {/* nose and mouth */}
      <path d="M32 30.4v2.4q-.9.7-1.8.3" stroke="#000" strokeOpacity="0.22" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M28.4 35.6q3.6 3 7.2 0" stroke="#33291f" strokeWidth="1.6" fill="none" strokeLinecap="round" className="av-mouth" />

      {/* a little colour in the cheeks */}
      <ellipse cx="24.6" cy="32.6" rx="2.2" ry="1.4" fill="#e2716d" opacity="0.18" />
      <ellipse cx="39.4" cy="32.6" rx="2.2" ry="1.4" fill="#e2716d" opacity="0.18" />
    </svg>
  );

  return bare ? svg : <span className={`${className} av-wrap`}>{svg}</span>;
}

/** Convenience wrapper: takes a team member record. */
export function MemberAvatar({ member, className = 'avatar-cell' }) {
  const [sex, variant] = member?.av || ['male', 0];
  return <Avatar sex={sex} variant={variant} className={className} title={member?.name} />;
}
