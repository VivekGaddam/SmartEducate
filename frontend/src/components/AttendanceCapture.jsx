import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import { useAuth } from '../context/AuthContext';

const AttendanceCapture = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [classId, setClassId] = useState('');
  const [recognizedStudents, setRecognizedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setError(null);

    // Create preview
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile || !classId) {
      setError('Please select a photo and enter class ID');
      return;
    }

    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('classId', classId);

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/student/attendance', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      setRecognizedStudents(response.data.students);
      setSuccess('Attendance marked successfully!');
      
      // Clear form
      setSelectedFile(null);
      setPreview(null);
      setClassId('');
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error processing attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!classId) {
      setError('Please enter class ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess('');

    try {
      // Get the video stream from the webcam
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Wait for the video to be ready
      videoRef.current.onloadedmetadata = async () => {
        videoRef.current.play();

        // Create a canvas element to capture the photo
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Set the canvas size to the video size
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        // Draw the video frame to the canvas
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // Get the image data from the canvas
        const imageData = canvas.toDataURL('image/jpeg');

        // Stop the video stream
        stream.getTracks().forEach(track => track.stop());

        // Send the image data to the server
        const response = await axios.post('/api/student/attendance/capture', {
          image: imageData,
          classId,
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        setRecognizedStudents(response.data.students);
        setSuccess('Attendance marked successfully!');
        
        // Clear form
        setSelectedFile(null);
        setPreview(null);
        setClassId('');
        
      };
    } catch (err) {
      setError(err.response?.data?.message || 'Error capturing attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-gray-900 mb-8 text-center"
        >
          Mark Attendance
        </motion.h1>

        <Card className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">Class ID</label>
              <input
                type="text"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                placeholder="Enter class ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                required
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Group Photo</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
                  required
                />
              </div>
              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="mt-4 relative"
                  >
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-64 rounded-lg shadow-lg mx-auto"
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <button
                type="submit"
                disabled={loading || !selectedFile || !classId}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-white text-sm font-medium
                  ${loading || !selectedFile || !classId
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'} 
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                {loading ? <LoadingSpinner /> : 'Mark Attendance'}
              </button>
            </motion.div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleCapture}
              disabled={loading || isCapturing}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-white text-sm font-medium
                ${loading || isCapturing
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'} 
                transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
            >
              {loading ? <LoadingSpinner /> : isCapturing ? 'Capturing...' : 'Capture Attendance via Webcam'}
            </button>
          </div>
        </Card>

        <AnimatePresence>
          {recognizedStudents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <Card>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Attendance Marked ({recognizedStudents.length} students)
                </h3>
                <div className="space-y-2">
                  {recognizedStudents.map((student, index) => (
                    <motion.div
                      key={student.studentId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center p-3 bg-green-50 rounded-lg"
                    >
                      <svg
                        className="w-5 h-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">Student ID: {student.studentId}</span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <Toast
              message={error}
              type="error"
              onClose={() => setError(null)}
            />
          )}
          {success && (
            <Toast
              message={success}
              type="success"
              onClose={() => setSuccess('')}
            />
          )}
        </AnimatePresence>

        <video
          ref={videoRef}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default AttendanceCapture;