import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa, { ParseResult } from 'papaparse';

interface CsvRow {
  email?: string;
  [key: string]: string | undefined;
}

interface EmailUpload {
  emailAddress: string;
}

const Uploader: React.FC = () => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    Papa.parse<CsvRow>(file, {
      complete: async (results: ParseResult<CsvRow>) => {
        const emails: EmailUpload[] = results.data
          .filter((row): row is CsvRow => row !== null && typeof row === 'object')
          .map((row) => ({
            emailAddress: row.email || row[0] || '', // Assumes first column is email if no header
          }));

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails }),
          });
          
          if (!response.ok) throw new Error('Upload failed');
          
          // Handle success
        } catch (error) {
          console.error('Error uploading emails:', error);
        }
      },
      header: true,
      skipEmptyLines: true,
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-8 text-center">
      <input {...getInputProps()} />
      <p>Drag & drop a CSV file here, or click to select one</p>
    </div>
  );
};

export default Uploader;