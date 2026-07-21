import { useRef } from 'react';

export default function FileUpload({ onFileSelected }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onFileSelected(file);
    inputRef.current.value = '';
  };

  return (
    <label className="file-upload" title="Attach a file">
      📎
      <input ref={inputRef} type="file" hidden onChange={handleChange} />
    </label>
  );
}
