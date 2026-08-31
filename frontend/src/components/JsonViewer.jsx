import { useState } from 'react';

export default function JsonViewer({ data }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  async function copyJson() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="json-viewer">
      <div className="json-viewer-header">
        <span>Response JSON</span>
        <button type="button" onClick={copyJson}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre>{json}</pre>
    </div>
  );
}
