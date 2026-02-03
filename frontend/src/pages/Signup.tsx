import React, { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '../components/ui';
import { MessageSquare, User, Mail, Lock } from 'lucide-react';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signup(email, password, name);
      navigate('/login', { state: { message: 'Account created! Please login.' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Signup failed';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 font-sans p-4">
      <Card padding="lg" className="w-full max-w-md shadow-xl bg-white/80 backdrop-blur-sm border-0 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 text-brand-primary mb-4">
            <MessageSquare size={32} />
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 tracking-tight">
            Create Account
          </h2>
          <p className="text-neutral-500 mt-2">
            Join FastSock today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <User size={18} />
              </div>
              <Input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Mail size={18} />
              </div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Lock size={18} />
              </div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 h-11"
              />
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full h-11 text-base shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all"
            loading={isLoading}
          >
            Create Account
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <span className="text-neutral-500">Already have an account? </span>
          <Link
            to="/login"
            className="font-semibold text-brand-primary hover:text-brand-primaryHover hover:underline transition-colors"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Signup;
