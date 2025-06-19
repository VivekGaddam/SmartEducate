import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { tutor } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function ProgressTracker() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    learningStyle: '',
    interests: [],
    goals: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [interest, setInterest] = useState('');

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const response = await tutor.getProgress();
        setProgress(response.data);
        setPreferences({
          learningStyle: response.data.learningStyle || '',
          interests: response.data.interests || [],
          goals: response.data.goals || ''
        });
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, []);

  const handleInterestAdd = () => {
    if (interest.trim() && !preferences.interests.includes(interest.trim())) {
      setPreferences({
        ...preferences,
        interests: [...preferences.interests, interest.trim()]
      });
      setInterest('');
    }
  };

  const handleInterestRemove = (interestToRemove) => {
    setPreferences({
      ...preferences,
      interests: preferences.interests.filter(i => i !== interestToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await tutor.updatePreferences(preferences);
      setIsEditing(false);
      const response = await tutor.getProgress();
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !progress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div
      id="student-dashboard"
      className="w-full min-h-screen flex justify-center items-start px-4 sm:px-6 lg:px-8"
      style={{ width: '100vw', height: '100vh' }}
    >
      <div className="max-w-4xl mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg overflow-hidden mb-8"
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Learning Progress</h2>
            <p className="text-blue-100">Track your academic journey</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-800 mb-2">Subjects</h3>
                <div className="flex flex-wrap gap-2">
                  {progress?.subjects?.map((subject, index) => (
                    <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {subject}
                    </span>
                  )) || <p className="text-gray-500">No subjects yet</p>}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h3 className="font-semibold text-green-800 mb-2">Learning Style</h3>
                <p className="text-gray-700">{progress?.learningStyle || 'Not specified'}</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h3 className="font-semibold text-purple-800 mb-2">Student ID</h3>
                <p className="text-gray-700">{progress?.studentId || user?.studentId || 'Not available'}</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Learning Preferences</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {isEditing ? 'Cancel' : 'Edit Preferences'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Learning Style
                    </label>
                    <select
                      value={preferences.learningStyle}
                      onChange={(e) => setPreferences({ ...preferences, learningStyle: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a learning style</option>
                      <option value="visual">Visual</option>
                      <option value="auditory">Auditory</option>
                      <option value="reading">Reading/Writing</option>
                      <option value="kinesthetic">Kinesthetic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interests
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-l p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Add an interest"
                      />
                      <button
                        type="button"
                        onClick={handleInterestAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preferences.interests.map((item, index) => (
                        <span key={index} className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {item}
                          <button
                            type="button"
                            onClick={() => handleInterestRemove(item)}
                            className="ml-1 text-blue-500 hover:text-blue-700"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Learning Goals
                    </label>
                    <textarea
                      value={preferences.goals}
                      onChange={(e) => setPreferences({ ...preferences, goals: e.target.value })}
                      rows="3"
                      className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="What are your learning goals?"
                    ></textarea>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Interests</h4>
                      <div className="flex flex-wrap gap-2">
                        {progress?.interests?.length > 0 ? (
                          progress.interests.map((interest, index) => (
                            <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                              {interest}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No interests added yet</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Goals</h4>
                      <p className="text-gray-600 text-sm">
                        {progress?.goals || 'No goals specified yet'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ Fixed Academic History Rendering */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Academic History</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                {progress?.academicHistory?.length > 0 ? (
                  <ul className="list-disc pl-5 text-gray-600">
                    {progress.academicHistory.map((item) => (
                      <li key={item._id}>
                        {item.subject}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No academic history available yet.</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
