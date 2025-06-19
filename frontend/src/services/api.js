import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log(token)
  return config;
});

export const auth = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  signup: (userData) => 
    api.post('/auth/signup', userData),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export const assignments = {
  // Teacher endpoints
  create: (assignmentData) => 
    api.post('/teacher/assignments', assignmentData),
    
  generateAiAssignment: (params) =>
    api.post('/teacher/assignments/generate', params),
    
  saveAiAssignment: (previewId) =>
    api.post(`/teacher/assignments/save/${previewId}`),
  
  getTeacherAssignments: () => 
    api.get('/teacher/assignments'),
  // Student endpoints
  getStudentAssignments: () => 
    api.get('/student/assignments'),
    
  getStudentSubmissions: () => 
    api.get('/student/submissions'),
  
  submit: (assignmentId, formData) => 
    api.post(`/student/submit/${assignmentId}`, formData),
    
  evaluateAssignment: (formData) =>
    api.post('/student/evaluate-assignment', formData)
};

export const tutor = {
  getProgress: () => 
    api.get('/tutor/progress'),
  
  updatePreferences: (preferences) => 
    api.put('/tutor/preferences', preferences)
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};
