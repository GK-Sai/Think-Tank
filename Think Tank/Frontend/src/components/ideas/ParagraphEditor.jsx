import { wordCount } from '../../lib/format';

export default function ParagraphEditor({ value, onChange }) {
  const n = wordCount(value);
  return (
    <>
      <textarea
        className="para-input"
        placeholder="Describe the idea in your own words…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="para-meta"><span>{n} word{n === 1 ? '' : 's'}</span></div>
    </>
  );
}
