import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Shield } from 'lucide-react';

const ApiDocs = () => {
  return (
    <div className="min-h-screen bg-[#09090b] bg-neon-radial text-gray-100 flex flex-col justify-between">
      <div>
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
                  <p className="text-xs text-cyan-400 font-medium tracking-wide uppercase">API Playground & Docs</p>
                </div>
              </div>
              <div>
                <Link to="/">
                  <Button variant="outline" className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 flex items-center gap-2 rounded-xl">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                <BookOpen className="w-8 h-8 text-cyan-400" />
                API Documentation
              </h2>
              <p className="text-gray-400 text-sm">
                Explore, test, and integrate the Traceify GPS REST API endpoints.
              </p>
            </div>
            <div className="flex gap-3">
              <a href="/swagger/index.html" target="_blank" rel="noopener noreferrer">
                <Button className="bg-neon-gradient hover:opacity-90 text-white border-0 rounded-xl">
                  Open in New Tab ↗
                </Button>
              </a>
            </div>
          </div>

          {/* Iframe container */}
          <div className="w-full bg-gray-950/40 border border-gray-900 rounded-2xl overflow-hidden shadow-2xl relative h-[78vh]">
            <iframe
              src="/swagger/index.html"
              title="Swagger API Documentation"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups"
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950/20 backdrop-blur-sm border-t border-gray-950/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-neon-gradient rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Traceify GPS Tracking Docs</p>
            </div>
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Chaitragorla. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ApiDocs;
