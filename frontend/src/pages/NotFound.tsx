import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800">
      <AlertTriangle size={64} className="text-yellow-500 mb-4" />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-xl mb-6">Page Not Found</p>
      <Link 
        to="/" 
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
      >
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;
