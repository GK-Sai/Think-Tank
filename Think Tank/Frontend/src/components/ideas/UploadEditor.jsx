import { useRef, useState } from 'react';
import { UploadIcon, CloseIcon } from '../../lib/icons';
import { fmtSize, extOf } from '../../lib/format';
import { useToast } from '../../store/ToastContext';

const MAX = 10 * 1024 * 1024;

export default function UploadEditor({ value, onChange }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const toast = useToast();

  const accept = (fileList) => {
    let rejected = 0;
    const added = [];
    Array.from(fileList).forEach((f) => {
      if (f.size > MAX) { rejected += 1; return; }
      added.push({ name: f.name, size: f.size, type: f.type });
    });
    if (rejected) toast(`${rejected} file${rejected === 1 ? ' was' : 's were'} over 10 MB and skipped`);
    if (added.length) onChange([...value, ...added]);
  };

  return (
    <>
      <div
        className={`drop-zone${over ? ' over' : ''}`}
        tabIndex={0}
        role="button"
        aria-label="Choose files to upload"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
        }}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer?.files) accept(e.dataTransfer.files);
        }}
      >
        <UploadIcon />
        <strong>Drop files here or tap to browse</strong>
        <span>PDF, images, documents or slides · up to 10&nbsp;MB each</span>
        <input
          type="file"
          multiple
          hidden
          ref={inputRef}
          onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
        />
      </div>

      <ul className="file-list">
        {value.map((f, idx) => (
          <li className="file-row" key={`${f.name}-${idx}`}>
            <span className="fi">{extOf(f.name)}</span>
            <span className="fname"><strong>{f.name}</strong><span>{fmtSize(f.size)}</span></span>
            <button
              type="button"
              className="kill"
              aria-label={`Remove ${f.name}`}
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              <CloseIcon strokeWidth={2.2} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
