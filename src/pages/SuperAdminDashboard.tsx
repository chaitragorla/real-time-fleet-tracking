import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import DeviceManagement from '../components/DeviceManagement';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { Crown, Users, LogOut, Trash2, RefreshCw, BookOpen } from 'lucide-react';

interface Customer {
  id: string | number;
  full_name: string;
  username: string;
  phone_number: string;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [deleteCustomerDialog, setDeleteCustomerDialog] = useState<{
    open: boolean;
    customerId: string | number | null;
    customerName: string;
  }>({
    open: false,
    customerId: null,
    customerName: ''
  });

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const { data } = await api.users.list('customer');
      setCustomers((data || []).map(user => ({
        id: user.id,
        full_name: user.full_name,
        username: user.email || user.phone_number,
        phone_number: user.phone_number,
        created_at: user.created_at || ''
      })));
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleDeleteCustomerClick = (customerId: string | number, customerName: string) => {
    setDeleteCustomerDialog({
      open: true,
      customerId,
      customerName
    });
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteCustomerDialog.customerId) return;

    try {
      await api.users.remove(deleteCustomerDialog.customerId, 'customer');
      toast({
        title: "Success",
        description: "Customer deleted successfully.",
      });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer.",
        variant: "destructive",
      });
    } finally {
      setDeleteCustomerDialog({ open: false, customerId: null, customerName: '' });
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="bg-gray-950/40 backdrop-blur-md border-b border-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neon-gradient rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight">Traceify</h1>
                  <p className="text-xs text-violet-400 font-semibold tracking-wider uppercase">Super Admin Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/api-docs">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    API Docs
                  </Button>
                </Link>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-200">{user?.name}</p>
                  <p className="text-xs text-violet-400 capitalize font-medium">{user?.role}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="flex items-center gap-2 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              System Dashboard 👑
            </h2>
            <p className="text-gray-400 text-sm">
              Complete oversight of Traceify platform operations: manage customers and track hardware devices.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gray-900/40 border-gray-800 shadow-xl backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Customers</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{customers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="customers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-1/3 bg-gray-950/60 p-1 border border-gray-800 rounded-lg">
              <TabsTrigger 
                value="customers"
                className="rounded-md py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black text-gray-400 font-medium"
              >
                Customers
              </TabsTrigger>
              <TabsTrigger 
                value="devices"
                className="rounded-md py-2 data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 font-medium"
              >
                Devices
              </TabsTrigger>
            </TabsList>

            {/* Customers Tab */}
            <TabsContent value="customers" className="space-y-6">
              <Card className="bg-gray-900/40 border-gray-800 shadow-xl backdrop-blur-md">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Users className="w-5 h-5 text-cyan-400" />
                        Customer Directory
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        Complete overview of all registered customers
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={fetchCustomers}
                      disabled={isLoadingCustomers}
                      variant="outline"
                      className="w-fit border-gray-800 hover:bg-gray-950 text-gray-300 rounded-xl h-11"
                    >
                      {isLoadingCustomers ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Refresh Data
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-gray-800 hover:bg-transparent">
                          <TableHead className="text-gray-400 font-semibold">Full Name</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Username</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Phone</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Registered</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id} className="border-b border-gray-800 hover:bg-gray-950/20">
                            <TableCell className="text-white font-medium">{customer.full_name}</TableCell>
                            <TableCell className="font-mono text-sm text-cyan-400">{customer.username}</TableCell>
                            <TableCell className="text-gray-300">{customer.phone_number}</TableCell>
                            <TableCell className="text-gray-300">
                              {new Date(customer.created_at).toLocaleDateString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCustomerClick(customer.id, customer.full_name)}
                                className="text-red-400 hover:text-red-500 border-gray-800 hover:bg-gray-950 rounded-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {customers.length === 0 && !isLoadingCustomers && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No customers found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Devices Tab */}
            <TabsContent value="devices" className="space-y-6">
              <DeviceManagement />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <ConfirmationDialog
        open={deleteCustomerDialog.open}
        onOpenChange={(open) => setDeleteCustomerDialog({ ...deleteCustomerDialog, open })}
        title="Delete Customer"
        description={`Are you sure you want to delete customer "${deleteCustomerDialog.customerName}"? This action cannot be undone and will permanently remove all their allocated devices and history.`}
        onConfirm={confirmDeleteCustomer}
        confirmText="Delete Customer"
      />
    </div>
  );
};

export default SuperAdminDashboard;
