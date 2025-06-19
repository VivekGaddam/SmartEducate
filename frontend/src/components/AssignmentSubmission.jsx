import React, { useState } from 'react';
import { assignments } from '../services/api';
import Toast from './Toast';

export default function AssignmentSubmission() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setSelectedFiles(e.target.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    for (let file of selectedFiles) {
      formData.append('files', file);
    }

    try {
      await assignments.submitAssignment(formData);
      setMessage('Assignment submitted successfully!');
    } catch (error) {
      setMessage('Failed to submit assignment.');
    }
  };

  return (
    <div className="p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Submit Assignment</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="mb-4 border p-2 w-full"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Submit
        </button>
      </form>
      {message && <Toast message={message} />}
    </div>
  );
}
