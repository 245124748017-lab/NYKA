import React, { useState, useRef } from 'react';

export default function UploadCSV({ onFileUpload, currentFile }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadError('Only CSV files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(`✅ Successfully uploaded: ${file.name}`);
        onFileUpload(file.name);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await res.json();
        setUploadError(`❌ Upload failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setUploadError(`❌ Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-csv-container">
      <div className="upload-content">
        <h3>📁 Upload Your CSV Data</h3>
        <p className="upload-description">
          Upload your own data to start asking questions. Supports CSV files up to 10MB.
        </p>

        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={uploading}
            className="file-input"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="upload-label">
            <div className="upload-icon">📤</div>
            <div className="upload-text">
              {uploading ? (
                <>
                  <p className="upload-main">Uploading...</p>
                  <p className="upload-sub">Please wait</p>
                </>
              ) : (
                <>
                  <p className="upload-main">Click to upload or drag and drop</p>
                  <p className="upload-sub">CSV files only (max 10MB)</p>
                </>
              )}
            </div>
          </label>
        </div>

        {uploadError && <div className="upload-error">{uploadError}</div>}
        {uploadSuccess && <div className="upload-success">{uploadSuccess}</div>}

        {currentFile && currentFile !== 'default' && (
          <div className="current-file">
            <span className="file-badge">📊 Currently using: {currentFile}</span>
          </div>
        )}
      </div>
    </div>
  );
}
