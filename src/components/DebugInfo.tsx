import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DebugInfo = () => {
  const { user } = useAuth();
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDebugQueries = async () => {
    setIsLoading(true);
    const results: any = {};

    try {
      // Check user info
      results.user = user;
      results.userId = user?.id;
      results.userIdType = typeof user?.id;
      results.userIdAsNumber = user?.id ? Number(user.id) : null;

      // Check all devices
      const { data: allDevices } = await api.devices.list();
      
      results.allDevices = allDevices;
      results.totalDevicesCount = allDevices?.length || 0;

      // Check devices for current user
      if (user?.id) {
        const { data: userDevices } = await api.devices.byOwner(user.id);
        
        results.userDevices = userDevices;
        results.userDevicesCount = userDevices?.length || 0;
      }

      // Check Mongo-backed users collection via REST
      const { data: allUsers } = await api.users.list('customer');
      
      results.allUsers = allUsers;
      results.totalUsersCount = allUsers?.length || 0;

      setDebugData(results);
    } catch (error) {
      console.error('Debug query error:', error);
      results.error = error;
      setDebugData(results);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      runDebugQueries();
    }
  }, [user]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Debug Information</CardTitle>
        <Button onClick={runDebugQueries} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh Debug Info'}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

export default DebugInfo;
