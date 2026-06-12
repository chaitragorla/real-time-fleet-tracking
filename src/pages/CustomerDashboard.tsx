import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { CustomerSidebar } from '../components/CustomerSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';
import QRScanner from '../components/QRScanner';
import CustomerDevices from '../components/CustomerDevices';
import TripHistory from '../components/TripHistory';

import ConfirmationDialog from '../components/ConfirmationDialog';
import { toast } from '@/hooks/use-toast';

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState(() => {
    return localStorage.getItem('login_mode') === 'user' ? 'add-device' : 'my-devices';
  });
  const [customerData, setCustomerData] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user]);

  const fetchCustomerData = async () => {
    if (!user) return;

    try {
      const { data } = await api.users.list('customer');
      setCustomerData((data || []).find((customer) => String(customer.id) === String(user.id)) || null);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    }
  };

  const getRegistrationYear = () => {
    if (customerData?.created_at) {
      const date = new Date(customerData.created_at);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return new Date().toLocaleDateString('en-IN');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'deletemyaccount') {
      toast({
        title: "Error",
        description: "Please type 'deletemyaccount' to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    try {
      await api.users.remove(user.id, 'customer');

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });

      logout();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderAccount = () => (
    <div className="space-y-8 max-w-4xl">
      <Card className="bg-gray-900/40 border-gray-800 shadow-2xl backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-2xl font-bold">
            <Shield className="w-6 h-6 text-cyan-400" />
            Account Information
          </CardTitle>
          <CardDescription className="text-gray-400">Your account details and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                <p className="text-lg font-bold text-white mt-1">{customerData?.full_name || user?.name}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
                <p className="text-lg text-gray-200 mt-1">{customerData?.phone_number || user?.phone_number || 'Not provided'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Type</label>
                <p className="text-lg text-gray-200 mt-1 capitalize">{user?.role}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Member Since</label>
                <p className="text-lg text-gray-200 mt-1">{getRegistrationYear()}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Account Status</label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800">
            <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-400 mb-4">
                Deleting your account is permanent. All your allocated devices and tracking data will be removed.
              </p>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 rounded-xl"
              >
                Delete My Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Account"
        description=""
        confirmText="Delete Account"
        cancelText="Cancel"
        onConfirm={handleDeleteAccount}
      >
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
            <p className="text-sm text-red-400 font-semibold mb-2">⚠️ Permanent Action</p>
            <p className="text-xs text-gray-300">
              Are you sure you want to delete your account? This action cannot be reversed.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type <span className="font-mono bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 text-red-400">deletemyaccount</span> to confirm:
            </label>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'deletemyaccount' to confirm"
              className="w-full bg-gray-950/40 border-gray-800 focus-visible:ring-red-500 text-white rounded-xl h-11"
            />
          </div>
        </div>
      </ConfirmationDialog>
    </div>
  );

  const renderAddDevice = () => {
    return <QRScanner />;
  };

  const renderMyDevices = () => {
    return <CustomerDevices />;
  };

  const renderTrips = () => {
    return <TripHistory />;
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'add-device':
        return renderAddDevice();
      case 'my-devices':
        return renderMyDevices();
      case 'trips':
        return renderTrips();
      case 'account':
        return renderAccount();
      default:
        return renderMyDevices();
    }
  };

  const isUserMode = user?.email === 'user@example.com' || localStorage.getItem('login_mode') === 'user';

  if (isUserMode) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#09090b] text-white overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-900 bg-gray-950/40">
          <h1 className="text-lg font-bold text-white">Traceify GPS Scan Center</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logout}
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl"
          >
            Logout
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#09090b]">
          <QRScanner />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#09090b]">
        <CustomerSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <SidebarInset className="flex-1 bg-[#09090b] flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-gray-900 bg-gray-950/40">
            <SidebarTrigger className="text-gray-400 hover:text-white" />
            <h1 className="text-lg font-bold text-white">Traceify GPS Tracking</h1>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default CustomerDashboard;
