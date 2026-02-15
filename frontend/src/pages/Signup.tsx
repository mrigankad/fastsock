import React, { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '../design-system';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleUsernameChange = (val: string) => {
    // Only allow lowercase letters, numbers, underscores
    setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await signup(email, password, name, username || undefined);
      navigate('/login', { state: { message: 'Account created! Please login.' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Signup failed';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 font-sans">
      <Card padding="lg" className="w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-neutral-900">
          Create Account
        </h2>

        <div className="flex mb-6 border-b border-neutral-200">
          <Link
            to="/login"
            className="flex-1 py-2 font-medium text-center text-neutral-600 hover:text-neutral-800"
          >
            Login
          </Link>
          <div
            className="flex-1 py-2 font-medium text-center text-brand-primary border-b-2 border-brand-primary"
          >
            Sign Up
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-medium text-sm select-none">@</span>
            <Input
              type="text"
              placeholder="username (optional)"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              className="pl-7"
            />
          </div>
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
            Sign Up
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Signup;
