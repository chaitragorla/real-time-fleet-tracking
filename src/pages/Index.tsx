import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Smartphone, ArrowRight, Database, Settings } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();

  if (user) {
    // Redirect authenticated users to their dashboard
    const dashboardPath = user.role === 'customer' ? '/customer/dashboard' : '/superadmin/dashboard';
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] bg-neon-radial relative overflow-hidden">
        <div className="absolute inset-0 bg-[#09090b]/40 backdrop-blur-[2px]" />
        <div className="relative text-center z-10 p-8 rounded-2xl bg-gray-900/40 border border-gray-800 backdrop-blur-md shadow-2xl max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-neon-gradient rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-gray-400 text-sm mb-6">{user.name}</p>
          <Link to={dashboardPath} className="block w-full">
            <Button className="w-full bg-neon-gradient hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 py-6 rounded-xl">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] bg-neon-radial relative text-gray-100 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-gray-950/40 backdrop-blur-md border-b border-gray-900/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neon-gradient rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Traceify</h1>
                <p className="text-xs text-cyan-400 font-medium tracking-wide uppercase">GPS Tracking Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/api-docs" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors mr-2">
                API Docs
              </Link>
              <Link to="/login">
                <Button variant="outline" className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-neon-gradient hover:opacity-90 text-white border-0">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex-1 flex flex-col justify-center relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
            Role-Based <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent text-glow-cyan">GPS Device Tracking</span>
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Secure, premium, and real-time device tracking platform. Scan QR codes to instantly link devices, view real-time paths on customized maps, and manage role-based controls.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-neon-gradient hover:opacity-90 text-white border-0 font-semibold px-8 py-6 rounded-xl">
                Explore the Platform
              </Button>
            </Link>
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-gray-800 text-gray-300 hover:bg-gray-900 px-8 py-6 rounded-xl">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-gray-900/40 backdrop-blur-md border-gray-800 hover:border-cyan-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader>
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white text-xl">Multi-Role Control</CardTitle>
              <CardDescription className="text-gray-400 text-sm mt-2 leading-relaxed">
                Seamless customer and superadmin separation. Secure routing safeguards coordinates and device allocations.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-900/40 backdrop-blur-md border-gray-800 hover:border-violet-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader>
              <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4 border border-violet-500/20 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6 text-violet-400" />
              </div>
              <CardTitle className="text-white text-xl">QR Link & Map Path</CardTitle>
              <CardDescription className="text-gray-400 text-sm mt-2 leading-relaxed">
                Claim devices instantly by scanning QR codes. View beautiful live trajectories and mapped history on-demand.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-900/40 backdrop-blur-md border-gray-800 hover:border-cyan-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader>
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white text-xl">Automatic Simulations</CardTitle>
              <CardDescription className="text-gray-400 text-sm mt-2 leading-relaxed">
                Get immediate tracking data automatically upon linking a device, allowing you to trace simulated vehicle movements without delays.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-[#083344]/80 to-[#2e1065]/80 border-gray-800/80 shadow-2xl backdrop-blur-md overflow-hidden relative">
            <div className="absolute inset-0 bg-neon-gradient opacity-[0.03]" />
            <CardContent className="p-10 relative z-10">
              <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                Ready to Track Your Fleet?
              </h2>
              <p className="text-gray-300 mb-8 max-w-xl mx-auto text-sm leading-relaxed">
                Experience high-performance, secure, and beautiful tracking. Get started with Traceify for free today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-neon-gradient hover:opacity-90 text-white border-0 font-semibold rounded-xl px-8">
                    Get Started
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-gray-700 text-gray-300 hover:bg-gray-900 rounded-xl px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950/20 backdrop-blur-sm border-t border-gray-950/80 py-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-neon-gradient rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Traceify GPS Tracking</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link to="/api-docs" className="text-xs text-gray-400 hover:text-white transition-colors">
                API Documentation
              </Link>
              <p className="text-xs text-gray-500">
                © {new Date().getFullYear()} Chaitragorla. Premium GPS Track & Route Simulator. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
