import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { User, Shield, Crown, Mail, Lock } from 'lucide-react';
import { UserRole } from '@/lib/api';

const Login = () => {
  const [customerForm, setCustomerForm] = useState({ email: '', password: '' });
  const [superAdminForm, setSuperAdminForm] = useState({ email: '', password: '' });
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent, form: { email: string; password: string }, role: UserRole) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({
        title: "Credentials required",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }
    const success = await login(form.email, form.password, role);

    if (success) {
      toast({
        title: "Access granted",
        description: `Welcome to the ${role} dashboard.`,
      });
      if (role === 'superadmin') navigate('/superadmin/dashboard');
      else navigate('/customer/dashboard');
    } else {
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] bg-neon-radial p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#09090b]/40 backdrop-blur-[2px]" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neon-gradient rounded-full mb-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-neon-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Traceify</h1>
          <p className="text-cyan-400 text-xs tracking-wider uppercase font-semibold mt-1">Secure GPS Tracking Access</p>
        </div>

        <Card className="shadow-2xl border-gray-800 bg-gray-900/40 backdrop-blur-md glow-border-neon">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">Sign In</CardTitle>
            <CardDescription className="text-gray-400">Choose your access level to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="customer" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-gray-950/60 p-1 border border-gray-800 rounded-lg">
                <TabsTrigger 
                  value="customer" 
                  className="flex items-center gap-2 rounded-md py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black text-gray-400"
                >
                  <User className="w-4 h-4" />
                  Customer
                </TabsTrigger>
                <TabsTrigger 
                  value="superadmin" 
                  className="flex items-center gap-2 rounded-md py-2 data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400"
                >
                  <Crown className="w-4 h-4" />
                  Super Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="customer" className="space-y-4">
                <form onSubmit={(e) => handleLogin(e, customerForm, 'customer')} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-email" className="text-gray-300 text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="customer-email"
                        type="email"
                        placeholder="customer@example.com"
                        className="pl-10 bg-gray-950/40 border-gray-800 focus-visible:ring-cyan-500 text-white placeholder-gray-600 rounded-xl"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-password" className="text-gray-300 text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="customer-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-gray-950/40 border-gray-800 focus-visible:ring-cyan-500 text-white placeholder-gray-600 rounded-xl"
                        value={customerForm.password}
                        onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-neon-gradient hover:opacity-90 text-white border-0 font-semibold py-6 rounded-xl"
                    disabled={isLoading || !customerForm.email || !customerForm.password}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In as Customer'}
                  </Button>
                </form>
                <div className="text-center pt-2">
                  <Link
                    to="/signup"
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors underline block"
                  >
                    Don't have an account? Sign up
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="superadmin" className="space-y-4">
                <form onSubmit={(e) => handleLogin(e, superAdminForm, 'superadmin')} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="superadmin-email" className="text-gray-300 text-sm font-medium">Super Admin Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="superadmin-email"
                        type="email"
                        placeholder="superadmin@example.com"
                        className="pl-10 bg-gray-950/40 border-gray-800 focus-visible:ring-violet-500 text-white placeholder-gray-600 rounded-xl"
                        value={superAdminForm.email}
                        onChange={(e) => setSuperAdminForm({ ...superAdminForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="superadmin-password" className="text-gray-300 text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="superadmin-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-gray-950/40 border-gray-800 focus-visible:ring-violet-500 text-white placeholder-gray-600 rounded-xl"
                        value={superAdminForm.password}
                        onChange={(e) => setSuperAdminForm({ ...superAdminForm, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white border-0 font-semibold py-6 rounded-xl"
                    disabled={isLoading || !superAdminForm.email || !superAdminForm.password}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In as Super Admin'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
