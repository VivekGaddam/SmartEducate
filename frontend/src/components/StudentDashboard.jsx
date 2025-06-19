import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assignments } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import AITutor from './AITutor';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [assignmentList, setAssignmentList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [submission, setSubmission] = useState({ answers: [] });
  const [activeTab, setActiveTab] = useState('assignments');
  const [imagePreviews, setImagePreviews] = useState({});

  useEffect(() => {
    loadAssignments();
    loadSubmissions();
  }, []);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const response = await assignments.getStudentAssignments();
      setAssignmentList(response.data);
      localStorage.setItem('assignments', JSON.stringify(response.data));
    } catch {
      setError('Failed to load assignments');
      const cached = localStorage.getItem('assignments');
      if (cached) {
        setAssignmentList(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      const response = await assignments.getStudentSubmissions();
      const submissionMap = {};
      response.data.forEach(sub => {
        submissionMap[sub.assignmentId._id] = sub;
      });
      setSubmissions(submissionMap);
    } catch {
      setError('Failed to load submissions');
    }
  };

  const handleAnswerChange = (index, value) => {
    setSubmission(prev => {
      const newAnswers = [...prev.answers];
      newAnswers[index] = value;
      return { ...prev, answers: newAnswers };
    });
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSubmission(prev => {
      const newAnswers = [...prev.answers];
      newAnswers[index] = { type: 'image', file };
      return { ...prev, answers: newAnswers };
    });

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => ({ ...prev, [index]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('answers', JSON.stringify(
        selectedAssignment.questions.map((_, i) => {
          const ans = submission.answers[i];
          return typeof ans === 'string' ? ans : '';
        })
      ));
      selectedAssignment.questions.forEach((_, i) => {
        const ans = submission.answers[i];
        if (ans && ans.file) {
          formData.append('images', ans.file);
        }
      });
      await assignments.submit(selectedAssignment._id, formData);
      setSuccess('Assignment submitted successfully!');
      setSelectedAssignment(null);
      loadSubmissions();
    } catch {
      setError('Failed to submit assignment');
    } finally {
      setIsLoading(false);
    }
  };

  const assignmentStatus = (assignment) => {
    return submissions[assignment._id] ? 'Submitted' : 'Pending';
  };

  return (
    <div
      id="student-dashboard"
      className="w-full min-h-screen flex justify-center items-start px-4 sm:px-6 lg:px-8  bg-gray-50"
      style={{width: '100vw', height: '100vh'}}
    >
      <div className="w-full max-w-screen-xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white shadow-lg rounded-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome, {user?.name}!</h1>
          <p className="text-blue-100">Manage your assignments and track your progress.</p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex justify-start space-x-6 px-4 py-3">
            {['assignments', 'submissions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors duration-300 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-blue-600'
                }`}
              >
                {tab === 'assignments' ? 'Assignments' : 'My Submissions'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 md:p-6">
          {error && <Toast message={error} type="error" onClose={() => setError('')} />}
          {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}

          {isLoading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : activeTab === 'assignments' ? (
            selectedAssignment ? (
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedAssignment(null)}
                  className="text-blue-600 hover:underline flex items-center"
                >
                  ← Back to Assignments
                </button>

                <div className="bg-gray-50 p-6 rounded-lg shadow">
                  <h2 className="text-xl font-semibold mb-2">{selectedAssignment.title}</h2>
                  <p className="text-gray-600 mb-4">{selectedAssignment.description}</p>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {selectedAssignment.questions.map((q, i) => (
                      <div key={i} className="bg-white p-4 rounded-md border space-y-3">
                        <p className="font-medium text-gray-800">{i + 1}. {q.questionText}</p>
                        {q.type === 'text' || q.type === 'open-ended' ? (
                          <textarea
                            rows={3}
                            className="w-full border p-2 rounded focus:ring-blue-500"
                            placeholder="Write your answer..."
                            value={submission.answers[i] || ''}
                            onChange={(e) => handleAnswerChange(i, e.target.value)}
                          />
                        ) : q.type === 'mcq' ? (
                          <div className="space-y-2">
                            {q.options.map((opt, j) => (
                              <label key={j} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`q-${i}`}
                                  checked={submission.answers[i] === opt}
                                  onChange={() => handleAnswerChange(i, opt)}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : q.type === 'image' ? (
                          <div>
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(i, e)} />
                            {imagePreviews[i] && <img src={imagePreviews[i]} alt="Preview" className="mt-2 max-h-40 rounded" />}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Submitting...' : 'Submit'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignmentList.length > 0 ? assignmentList.map((a) => (
                  <Card
                    key={a._id}
                    title={a.title}
                    description={`${a.description.slice(0, 100)}${a.description.length > 100 ? '...' : ''}`}
                    status={assignmentStatus(a)}
                    date={new Date(a.createdAt).toLocaleDateString()}
                    onClick={() => {
                      setSelectedAssignment(a);
                      setSubmission({ answers: [] });
                    }}
                    className={submissions[a._id] ? 'border-green-500' : 'border-yellow-500'}
                  />
                )) : (
                  <p className="col-span-full text-center text-gray-500">No assignments found.</p>
                )}
              </div>
            )
          ) : (
            <div className="space-y-6">
              {Object.values(submissions).length > 0 ? Object.values(submissions).map((sub) => (
                <div key={sub._id} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{sub.assignmentId.title}</h3>
                  <p className="text-sm text-gray-500 mb-4">Submitted on {new Date(sub.createdAt).toLocaleDateString()}</p>
                  <div className="bg-gray-50 rounded p-4">
                    {sub.answers.map((ans, i) => (
                      <div key={i} className="mb-3">
                        <p className="text-sm text-gray-600">Q{i + 1}:</p>
                        {typeof ans === 'string' ? (
                          <p>{ans || '[No answer provided]'}</p>
                        ) : ans.imageUrl ? (
                          <img src={ans.imageUrl} alt={`Q${i + 1}`} className="mt-1 max-h-40 rounded" />
                        ) : (
                          <p>[No answer provided]</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {sub.feedback && (
                    <div className="mt-4 p-4 bg-blue-50 rounded">
                      <h4 className="font-semibold text-blue-700 mb-1">Feedback:</h4>
                      <p>{sub.feedback}</p>
                    </div>
                  )}
                  {sub.grade && (
                    <p className="mt-2 font-medium">Grade: <span className="text-lg">{sub.grade}</span></p>
                  )}
                </div>
              )) : (
                <p className="text-center text-gray-500">No submissions found.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <div className="mt-6">
        <AITutor />
      </div>
    </div>
    </div>
  );
}
