// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import AITutor from './components/AITutor';
import ProgressTracker from './components/ProgressTracker';
import AttendanceCapture from './components/AttendanceCapture';
import Navbar from './components/Navbar';
import './App.css';

// PrivateRoute component to protect dashboard routes
const PrivateRoute = ({ children, requiredRole = null }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

function App() {
  const { user } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {user && <Navbar />}
        <div className="pt-16"> {/* Add padding for the fixed navbar */}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Teacher Routes */}
            <Route
              path="/teacher/dashboard"
              element={
                <PrivateRoute requiredRole="teacher">
                  <TeacherDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/teacher/attendance"
              element={
                <PrivateRoute requiredRole="teacher">
                  <AttendanceCapture />
                </PrivateRoute>
              }
            />
            
            {/* Student Routes */}
            <Route
              path="/student/dashboard"
              element={
                <PrivateRoute requiredRole="student">
                  <StudentDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/tutor"
              element={
                <PrivateRoute requiredRole="student">
                  <AITutor />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/progress"
              element={
                <PrivateRoute requiredRole="student">
                  <ProgressTracker />
                </PrivateRoute>
              }
            />
            
            {/* Dashboard redirect based on role */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  {user?.role === 'teacher' ? 
                    <Navigate to="/teacher/dashboard" /> : 
                    <Navigate to="/student/dashboard" />
                  }
                </PrivateRoute>
              }
            />
            
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

// Wrap App in AuthProvider
function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;
