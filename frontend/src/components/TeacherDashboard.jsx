import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assignments } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [assignmentList, setAssignmentList] = useState([]);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    classLevel: '',
    questions: []
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    type: 'mcq',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiGenerateParams, setAiGenerateParams] = useState({
    studentId: '',
    classLevel: '',
    subject: '',
    topic: ''
  });
  const [showAiForm, setShowAiForm] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [activeTab, setActiveTab] = useState('create');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    loadAssignments();
    loadSubmissions();
  }, []);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const response = await assignments.getTeacherAssignments();
      setAssignmentList(response.data);
    } catch (err) {
      setError('Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadSubmissions = async () => {
    try {
      // This would be implemented in a real application
      // Mocking data for now
      setSubmissions([]);
    } catch (err) {
      setError('Failed to load submissions');
    }
  };

  const handleAddQuestion = () => {
    setNewAssignment(prev => ({
      ...prev,
      questions: [...prev.questions, currentQuestion]
    }));
    setCurrentQuestion({
      type: 'mcq',
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await assignments.create(newAssignment);
      setSuccess('Assignment created successfully!');
      setNewAssignment({
        title: '',
        description: '',
        classLevel: '',
        questions: []
      });
      loadAssignments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create assignment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAssignment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await assignments.generateAiAssignment(aiGenerateParams);
      setPreviewQuestions(response.data.questions);
      setPreviewId(response.data.preview_id);
      setSuccess('Assignment generated successfully!');
    } catch (err) {
      setError('Failed to generate AI assignment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!previewId) return;
    setIsLoading(true);
    
    try {
      await assignments.saveAiAssignment(previewId);
      setSuccess('AI assignment saved successfully!');
      setPreviewQuestions(null);
      setPreviewId(null);
      setShowAiForm(false);
      loadAssignments();
    } catch (err) {
      setError('Failed to save AI assignment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
          id="student-dashboard"
      className="w-full min-h-screen flex justify-center items-start px-4 sm:px-6 lg:px-8"
      style={{width: '100vw', height: '100vh'}}
>
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-gray-900 mb-8"
        >
          Teacher Dashboard
        </motion.h1>

        {/* Tab Navigation */}
        <div className="mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 px-4 rounded-l-lg font-medium transition-all duration-200 ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-indigo-50'
            }`}
          >
            Create Assignment
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`py-2 px-4 rounded-r-lg font-medium transition-all duration-200 ${
              activeTab === 'submissions'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-indigo-50'
            }`}
          >
            View Submissions
          </button>
        </div>

        {/* AI Assignment Generation */}
        {activeTab === 'create' && (
          <Card className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Generate AI Assignment</h2>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAiForm(!showAiForm)}
                className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                {showAiForm ? 'Hide Form' : 'Generate Assignment'}
              </motion.button>
            </div>

            <AnimatePresence>
              {showAiForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleGenerateAssignment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Student ID</label>
                      <input
                        type="text"
                        value={aiGenerateParams.studentId}
                        onChange={(e) => setAiGenerateParams(prev => ({ ...prev, studentId: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Class Level</label>
                      <select
                        value={aiGenerateParams.classLevel}
                        onChange={(e) => setAiGenerateParams(prev => ({ ...prev, classLevel: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select Level</option>
                        <option value="elementary">Elementary</option>
                        <option value="middle">Middle School</option>
                        <option value="high">High School</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject</label>
                      <select
                        value={aiGenerateParams.subject}
                        onChange={(e) => setAiGenerateParams(prev => ({ ...prev, subject: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select Subject</option>
                        <option value="math">Mathematics</option>
                        <option value="science">Science</option>
                        <option value="english">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Topic</label>
                      <input
                        type="text"
                        value={aiGenerateParams.topic}
                        onChange={(e) => setAiGenerateParams(prev => ({ ...prev, topic: e.target.value }))}
                        placeholder="e.g., Photosynthesis, Algebra, Shakespeare"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                    >
                      Generate Assignment
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview Questions */}
            <AnimatePresence>
              {previewQuestions && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <h3 className="text-lg font-medium mb-4">Preview Generated Questions</h3>
                  <div className="space-y-4">
                    {previewQuestions.map((question, idx) => (
                      <div key={idx} className="border rounded p-4">
                        <p className="font-medium mb-2">{question.questionText}</p>
                        {question.type === 'mcq' && (
                          <div className="ml-4">
                            {question.options.map((option, optIdx) => (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <span className={option === question.correctAnswer ? 'text-green-600 font-medium' : ''}>
                                  {option}
                                </span>
                                {option === question.correctAnswer && 
                                  <span className="text-xs text-green-600">(Correct)</span>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end space-x-4 mt-4">
                      <button
                        onClick={() => {
                          setPreviewQuestions(null);
                          setPreviewId(null);
                        }}
                        className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={handleSaveAssignment}
                        className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
                      >
                        Save Assignment
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}

        {/* Manual Assignment Creation */}
        {activeTab === 'create' && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Assignment</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  rows="3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Class Level</label>
                <input
                  type="text"
                  value={newAssignment.classLevel}
                  onChange={(e) => setNewAssignment(prev => ({ ...prev, classLevel: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Questions List */}
              <div className="mt-4">
                <h3 className="font-medium text-lg mb-2">Questions</h3>
                {newAssignment.questions.map((q, idx) => (
                  <div key={idx} className="p-3 border rounded mb-2">
                    <p><strong>Type:</strong> {q.type}</p>
                    <p><strong>Question:</strong> {q.questionText}</p>
                    {q.type === 'mcq' && (
                      <>
                        <p><strong>Options:</strong></p>
                        <ul className="list-disc pl-5">
                          {q.options.map((opt, i) => (
                            <li key={i}>{opt}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Question Form */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Add Question</h4>
                <div className="space-y-3">
                  <select
                    value={currentQuestion.type}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, type: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="written">Written</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Question Text"
                    value={currentQuestion.questionText}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, questionText: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />

                  {currentQuestion.type === 'mcq' && (
                    <div className="space-y-2">
                      {currentQuestion.options.map((opt, idx) => (
                        <input
                          key={idx}
                          type="text"
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const newOptions = [...currentQuestion.options];
                            newOptions[idx] = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
                          }}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      ))}
                      <select
                        value={currentQuestion.correctAnswer}
                        onChange={(e) => setCurrentQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="">Select Correct Answer</option>
                        {currentQuestion.options.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                  >
                    Add Question
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
              >
                Create Assignment
              </button>
            </form>
          </Card>
        )}

        {/* Submissions List */}
        {activeTab === 'submissions' && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Student Submissions</h2>
            <div className="space-y-4">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <AnimatePresence>
                  {submissions.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-4"
                    >
                      <p className="text-gray-500">No submissions found.</p>
                    </motion.div>
                  ) : (
                    submissions.map((submission, index) => (
                      <motion.div
                        key={submission._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-lg">{submission.studentId}</h3>
                          <span className="text-sm text-gray-500">
                            {new Date(submission.submittedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-600">{submission.comments}</p>
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-800 mb-2">Submitted Questions</h4>
                          {submission.questions.map((q, idx) => (
                            <div key={idx} className="border-t pt-2">
                              <p className="text-gray-700"><strong>Q{idx + 1}:</strong> {q.questionText}</p>
                              {q.type === 'mcq' && (
                                <p className="text-gray-700 ml-4">
                                  <strong>Your Answer:</strong> {q.selectedOption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Toast Notifications */}
      <AnimatePresence>
        {error && (
          <Toast
            message={error}
            type="error"
            onClose={() => setError('')}
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
    </div>
    </div>
  );
}
