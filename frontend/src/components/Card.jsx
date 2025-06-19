import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ title, description, status, date, onClick, children, className = '', delay = 0 }) => {
  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay } },
    hover: { y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)', transition: { duration: 0.2 } }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Submitted':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Graded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      onClick={onClick}
      className={`bg-white rounded-xl shadow-lg ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {title ? (
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          {description && <p className="text-gray-600 text-sm mb-4">{description}</p>}
          
          {(status || date) && (
            <div className="flex justify-between items-center">
              {status && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
                  {status}
                </span>
              )}
              {date && <span className="text-gray-500 text-xs">{date}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">{children}</div>
      )}
    </motion.div>
  );
};

export default Card;
