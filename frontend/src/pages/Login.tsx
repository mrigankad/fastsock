import React, { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '../design-system';

const Login: React.FC = () => {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      toast.success(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Successfully logged in!');
      navigate('/');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Authentication failed';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 font-sans">
      <Card padding="lg" className="w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-neutral-900">
          Welcome Back
        </h2>
        
        <div className="flex mb-6 border-b border-neutral-200">
          <div
            className="flex-1 py-2 font-medium text-center text-brand-primary border-b-2 border-brand-primary"
          >
            Login
          </div>
          <Link
            to="/signup"
            className="flex-1 py-2 font-medium text-center text-neutral-600 hover:text-neutral-800"
          >
            Sign Up
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <Button
            type="submit"
            className="w-full"
          >
            Login
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Login;
