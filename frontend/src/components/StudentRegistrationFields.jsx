import React from 'react';

const StudentRegistrationFields = ({ formData, setFormData }) => {
  return (
    <>
      <div>
        <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
          Student ID
        </label>
        <input
          id="studentId"
          name="studentId"
          type="text"
          required
          value={formData.studentId}
          onChange={e => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
          placeholder="e.g., STU2025001"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter your unique student identification number
        </p>
      </div>

      <div>
        <label htmlFor="parentPhone" className="block text-sm font-medium text-gray-700">
          Parent's Phone Number
        </label>
        <input
          id="parentPhone"
          name="parentPhone"
          type="tel"
          required
          value={formData.parentPhone}
          onChange={e => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700">
          Grade Level
        </label>
        <select
          id="gradeLevel"
          name="gradeLevel"
          required
          value={formData.gradeLevel}
          onChange={e => setFormData(prev => ({ ...prev, gradeLevel: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select Grade</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={`Grade ${i + 1}`}>
              Grade {i + 1}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Subjects
        </label>
        <div className="mt-2 space-y-2">
          {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'].map(subject => (
            <label key={subject} className="inline-flex items-center mr-4">
              <input
                type="checkbox"
                name="subjects"
                value={subject}
                checked={formData.subjects.includes(subject)}
                onChange={(e) => {
                  const subjects = e.target.checked
                    ? [...formData.subjects, subject]
                    : formData.subjects.filter(s => s !== subject);
                  setFormData(prev => ({ ...prev, subjects }));
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">{subject}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="learningStyle" className="block text-sm font-medium text-gray-700">
          Learning Style
        </label>
        <select
          id="learningStyle"
          name="learningStyle"
          required
          value={formData.learningStyle}
          onChange={e => setFormData(prev => ({ ...prev, learningStyle: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="visual">Visual</option>
          <option value="auditory">Auditory</option>
          <option value="reading">Reading/Writing</option>
          <option value="kinesthetic">Kinesthetic</option>
        </select>
      </div>

      <div>
        <label htmlFor="interests" className="block text-sm font-medium text-gray-700">
          Interests (Optional)
        </label>
        <input
          id="interests"
          name="interests"
          type="text"
          placeholder="e.g., Robotics, Art, Sports (comma-separated)"
          value={formData.interests.join(', ')}
          onChange={(e) => {
            const interests = e.target.value.split(',').map(i => i.trim()).filter(Boolean);
            setFormData(prev => ({ ...prev, interests }));
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="goals" className="block text-sm font-medium text-gray-700">
          Academic Goals (Optional)
        </label>
        <textarea
          id="goals"
          name="goals"
          rows="3"
          placeholder="What would you like to achieve this year?"
          value={formData.goals.join('\n')}
          onChange={(e) => {
            const goals = e.target.value.split('\n').filter(Boolean);
            setFormData(prev => ({ ...prev, goals }));
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
    </>
  );
};

export default StudentRegistrationFields;
