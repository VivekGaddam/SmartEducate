import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import classNames from 'classnames';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const ChatMessage = ({ message, isBot }) => (
  <div
    className={classNames(
      'flex w-full mb-4',
      isBot ? 'justify-start' : 'justify-end'
    )}
  >
    <div
      className={classNames(
        'max-w-[80%] rounded-lg p-3 shadow-sm',
        isBot
          ? 'bg-white text-gray-800 rounded-tl-none'
          : 'bg-blue-600 text-white rounded-tr-none'
      )}
    >
      <ReactMarkdown
        className={classNames(
          'prose',
          isBot ? 'prose-blue' : 'prose-invert',
          'max-w-none'
        )}
      >
        {message.content}
      </ReactMarkdown>
      <div
        className={classNames(
          'text-xs mt-1',
          isBot ? 'text-gray-500' : 'text-blue-100'
        )}
      >
        {format(new Date(message.timestamp), 'HH:mm')}
      </div>
    </div>
  </div>
);

const SuggestedQuestions = ({ onSelect }) => {
  const questions = [
    "How am I doing in mathematics?",
    "Can you recommend study tips for physics?",
    "What did my teacher say about my last assignment?",
    "Help me understand Newton's laws",
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {questions.map((question) => (
        <button
          key={question}
          onClick={() => onSelect(question)}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
        >
          {question}
        </button>
      ))}
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg max-w-[80px] mb-4">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
  </div>
);

const AITutor = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (user) {
      setMessages([
        {
          id: 'welcome',
          content: `Hi ${user.name}! I'm your AI tutor. How can I help you today?`,
          isBot: true,
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, [user]);

  // Set up Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    // Initialize socket connection
    socketRef.current = io(BACKEND_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    // Connection event
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
    });

    // Bot typing indicator
    socketRef.current.on('bot typing', (isTyping) => {
      setIsTyping(isTyping);
    });

    // Handle bot responses
    socketRef.current.on('chat response', (data) => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          content: data.message,
          isBot: true,
          timestamp: data.timestamp || new Date().toISOString(),
          intent: data.intent
        }
      ]);
    });

    // Error handling
    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-error',
          content: 'Sorry, I encountered an error. Please try again later.',
          isBot: true,
          timestamp: new Date().toISOString()
        }
      ]);
      setIsTyping(false);
    });

    // Cleanup function
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket');
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    // Log user info for debugging
    console.log('User data:', user);

    const userMessage = {
      id: Date.now().toString(),
      content: input,
      isBot: false,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send message through socket
    socketRef.current.emit('chat message', { message: input });
    
    setInput('');
  };

  const handleQuestionSelect = (question) => {
    setInput(question);
  };

  return (
        <div
          id="student-dashboard"
      className="w-full min-h-screen flex justify-center items-start px-4 sm:px-6 lg:px-8  bg-gray-50"
      style={{width: '100vw', height: '100vh'}}
>
    <div className="flex flex-col bg-gray-50 rounded-lg shadow-lg overflow-hidden h-[600px] max-w-4xl mx-auto my-8">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h2 className="text-xl font-bold">AI Tutor</h2>
        <p className="text-blue-100 text-sm">Your personalized learning assistant</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} isBot={message.isBot} />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-4">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
        <SuggestedQuestions onSelect={handleQuestionSelect} />
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask me anything..."
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
    </div>
  );
};

export default AITutor;
