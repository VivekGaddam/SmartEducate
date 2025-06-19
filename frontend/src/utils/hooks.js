import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Custom hook for managing form input state
export const useForm = (initialState = {}) => {
  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Update form values
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    
    setValues(prevValues => ({
      ...prevValues,
      [name]: fieldValue
    }));
    
    // Mark field as touched
    setTouched(prevTouched => ({
      ...prevTouched,
      [name]: true
    }));
    
    // Clear error for this field when changed
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: null
      }));
    }
  }, [errors]);

  // Set a single field value
  const setFieldValue = useCallback((name, value) => {
    setValues(prevValues => ({
      ...prevValues,
      [name]: value
    }));
  }, []);

  // Set multiple field values at once
  const setMultipleValues = useCallback((newValues) => {
    setValues(prevValues => ({
      ...prevValues,
      ...newValues
    }));
  }, []);

  // Reset the form to initial state
  const resetForm = useCallback(() => {
    setValues(initialState);
    setErrors({});
    setTouched({});
  }, [initialState]);

  // Validate the form
  const validate = useCallback((validationSchema) => {
    if (!validationSchema) return true;
    
    const newErrors = {};
    let isValid = true;
    
    // Loop through validation schema
    Object.keys(validationSchema).forEach(field => {
      const value = values[field];
      const fieldRules = validationSchema[field];
      
      // Check required
      if (fieldRules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field] = fieldRules.message || 'This field is required';
        isValid = false;
      }
      
      // Check min length
      if (value && fieldRules.minLength && value.length < fieldRules.minLength) {
        newErrors[field] = fieldRules.message || `Minimum length is ${fieldRules.minLength}`;
        isValid = false;
      }
      
      // Check max length
      if (value && fieldRules.maxLength && value.length > fieldRules.maxLength) {
        newErrors[field] = fieldRules.message || `Maximum length is ${fieldRules.maxLength}`;
        isValid = false;
      }
      
      // Check pattern
      if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
        newErrors[field] = fieldRules.message || 'Invalid format';
        isValid = false;
      }
      
      // Check custom validator
      if (fieldRules.validator && typeof fieldRules.validator === 'function') {
        const validatorResult = fieldRules.validator(value, values);
        if (validatorResult !== true) {
          newErrors[field] = validatorResult || fieldRules.message || 'Invalid value';
          isValid = false;
        }
      }
    });
    
    setErrors(newErrors);
    return isValid;
  }, [values]);

  return {
    values,
    errors,
    touched,
    handleChange,
    setFieldValue,
    setMultipleValues,
    resetForm,
    validate,
    setErrors
  };
};

// Custom hook for API calls with loading and error states
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  const callApi = useCallback(async (apiFunc, ...args) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiFunc(...args);
      setData(result.data);
      return result.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Something went wrong';
      setError(errorMsg);
      throw errorMsg;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { loading, error, data, callApi, setError };
};

// Custom hook for auth-related utilities
export const useAuthUtils = () => {
  const { user, login, logout } = useAuth();
  
  const isTeacher = useCallback(() => {
    return user?.role === 'teacher';
  }, [user]);
  
  const isStudent = useCallback(() => {
    return user?.role === 'student';
  }, [user]);
  
  const requiresAuth = useCallback((Component) => {
    return (props) => {
      if (!user) {
        return <Navigate to="/login" />;
      }
      return <Component {...props} />;
    };
  }, [user]);
  
  return { isTeacher, isStudent, requiresAuth };
};
