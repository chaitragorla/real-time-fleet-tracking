
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Smartphone, RefreshCw, Calendar, CheckCircle, MapPin, Eye, Satellite, Edit2, Check, X, Trash2, Share2 } from 'lucide-react';
import DeviceRouteMap from './DeviceRouteMap';
import GPSTracker from './GPSTracker';
import ConfirmationDialog from './ConfirmationDialog';
import QRCode from 'qrcode';

const QRImage: React.FC<{ code: string; qrCodeData?: string | null }> = ({ code, qrCodeData }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    if (qrCodeData?.startsWith('data:image')) {
      setSrc(qrCodeData);
    } else {
      QRCode.toDataURL(code, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(setSrc)
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [code, qrCodeData]);

  if (!src) {
    return (
      <div className="w-16 h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`QR Code for ${code}`}
      className="w-16 h-16 border border-gray-300 rounded"
    />
  );
};

interface Device {
  id: number;
  device_code: string;
  qr_code: string;
  created_at: string;
  is_active: boolean;
  allocated_to_customer_id: number | null;
  allocated_to_customer_name: string | null;
  allocated_at: string | null;
  device_name: string | null;
  device_m2m_number?: string | null;
}

const CustomerDevices = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<'route' | 'tracker'>('route');
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    deviceId: number | null;
    deviceName: string;
    deviceCode: string;
  }>({
    open: false,
    deviceId: null,
    deviceName: '',
    deviceCode: ''
  });
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  // Add state for share dialog
  const [shareDialog, setShareDialog] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [sharePhone, setSharePhone] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');

  const fetchMyDevices = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data } = await api.devices.byOwner(user.id);
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDevices();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeviceNameDoubleClick = (device: Device) => {
    setEditingDeviceId(device.id);
    setEditingDeviceName(device.device_name || '');
  };

  const handleDeviceNameSave = async (deviceId: number) => {
    try {
      await api.devices.updateById(deviceId, { device_name: editingDeviceName.trim() || null });

      // Update local state
      setDevices(devices.map(device =>
        device.id === deviceId
          ? { ...device, device_name: editingDeviceName.trim() || null }
          : device
      ));

      toast({
        title: 'Success',
        description: 'Device name updated successfully.',
      });

      setEditingDeviceId(null);
      setEditingDeviceName('');
    } catch (error) {
      console.error('Error updating device name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update device name. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeviceNameCancel = () => {
    setEditingDeviceId(null);
    setEditingDeviceName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, deviceId: number) => {
    if (e.key === 'Enter') {
      handleDeviceNameSave(deviceId);
    } else if (e.key === 'Escape') {
      handleDeviceNameCancel();
    }
  };

  const handleDeleteClick = (device: Device) => {
    setDeleteDialog({
      open: true,
      deviceId: device.id,
      deviceName: device.device_name || '',
      deviceCode: device.device_code
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.deviceId) return;
    setIsLoading(true);
    try {
      await api.gps.clear(deleteDialog.deviceCode);
      await api.devices.unassign(deleteDialog.deviceId);
      toast({
        title: 'Success',
        description: 'Device and its GPS data deleted successfully.',
      });
      fetchMyDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete device.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialog({ open: false, deviceId: null, deviceName: '', deviceCode: '' });
      setIsLoading(false);
    }
  };

  const confirmDeleteAll = async () => {
    if (!user || devices.length === 0) return;
    setIsLoading(true);
    try {
      await Promise.all(devices.map((device) => api.gps.clear(device.device_code)));
      await api.devices.unassignAll(user.id);
      toast({
        title: 'Success',
        description: 'All devices deleted successfully.',
      });
      fetchMyDevices();
    } catch (error) {
      console.error('Error deleting all devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete all devices.',
        variant: 'destructive',
      });
    } finally {
      setDeleteAllDialog(false);
      setIsLoading(false);
    }
  };

  // Device share handler
  const handleShareDevice = async () => {
    if (!shareDialog.device || !sharePhone.trim()) {
      setShareError('Please enter a valid phone number.');
      return;
    }

    setShareLoading(true);
    setShareError('');

    try {
      const response = await api.devices.share(shareDialog.device.device_code, sharePhone.trim());
      toast({
        title: 'Success',
        description: response.message || 'Device shared successfully.'
      });
      setShareDialog({ open: false, device: null });
      setSharePhone('');
    } catch (error) {
      console.error('Error sharing device:', error);
      setShareError('An unexpected error occurred. Please try again.');
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-8 h-8" />
          <h1 className="text-3xl font-bold">My Devices</h1>
        </div>
        <p className="text-lg opacity-90">
          View and manage all devices allocated to your account
        </p>
      </div>

      {/* Device Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owned Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {devices.length}
            </div>
          </CardContent>
        </Card>



        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {devices.filter(device => device.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Device List
              </CardTitle>
              <CardDescription>
                All devices allocated to your account
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={fetchMyDevices}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button
                onClick={() => setDeleteAllDialog(true)}
                disabled={devices.length === 0 || isLoading}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Devices
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Devices Found</h3>
              <p className="text-gray-500 mb-4">
                You haven't added any devices yet. Use the "Add Device" section to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Device Code</TableHead>

                    <TableHead>Status</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead>GPS Tracking</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        {editingDeviceId === device.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingDeviceName}
                              onChange={(e) => setEditingDeviceName(e.target.value)}
                              onKeyDown={(e) => handleKeyPress(e, device.id)}
                              placeholder="Enter device name"
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeviceNameSave(device.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleDeviceNameCancel}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded group"
                            onDoubleClick={() => handleDeviceNameDoubleClick(device)}
                            title="Double-click to edit device name"
                          >
                            <span>
                              {device.device_name || (
                                <span className="text-gray-400 italic">Unnamed Device</span>
                              )}
                            </span>
                            <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {device.device_code}
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${device.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {device.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDate(device.allocated_at || device.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => {
                            setSelectedDevice(device);
                            setActiveTab('tracker');
                            setShowTrackingDialog(true);
                          }}
                        >
                          <MapPin className="w-4 h-4" />
                          GPS Tracking
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          <QRImage code={device.device_code} qrCodeData={device.qr_code} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(device)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShareDialog({ open: true, device })}
                            className="text-blue-600 hover:text-blue-700"
                            title="Share Device"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title="Delete Device"
        description={`Are you sure you want to delete device "${deleteDialog.deviceName || deleteDialog.deviceCode}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete Device"
      />
      <ConfirmationDialog
        open={deleteAllDialog}
        onOpenChange={setDeleteAllDialog}
        title="Delete All Devices"
        description="Are you sure you want to delete all your devices? This action cannot be undone."
        onConfirm={confirmDeleteAll}
        confirmText="Delete All"
      />
      <ConfirmationDialog
        open={shareDialog.open}
        onOpenChange={(open) => setShareDialog({ open, device: open ? shareDialog.device : null })}
        title="Share Device"
        description={shareDialog.device ? `Share device '${shareDialog.device.device_name || shareDialog.device.device_code}' with another user by phone number.` : ''}
        onConfirm={handleShareDevice}
        confirmText={shareLoading ? 'Sharing...' : 'Share'}
        confirmDisabled={shareLoading || !sharePhone}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Recipient Phone Number</label>
          <input
            type="text"
            value={sharePhone}
            onChange={e => setSharePhone(e.target.value)}
            placeholder="Enter recipient's phone number"
            className="w-full border rounded px-2 py-1"
            disabled={shareLoading}
          />
          {shareError && <div className="text-red-600 text-sm">{shareError}</div>}
        </div>
      </ConfirmationDialog>

      {/* Central Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-950 border-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                Vehicle Tracking Center
              </span>
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Select your vehicle, view its automatic QR code, monitor live locations, and verify parking status.
            </DialogDescription>
          </DialogHeader>

          {/* Vehicle Selection Dropdown & QR Code Display */}
          <div className="flex flex-col md:flex-row items-center gap-6 bg-gray-900/40 p-4 border border-gray-800 rounded-xl mt-4">
            <div className="flex-1 w-full">
              <label className="text-xs font-semibold text-gray-400 block mb-1">Select Active Vehicle</label>
              <select
                className="w-full bg-gray-950/60 border border-gray-800 rounded-lg p-2.5 text-white font-medium focus:ring-1 focus:ring-blue-500"
                value={selectedDevice?.id || ''}
                onChange={(e) => {
                  const dev = devices.find(d => String(d.id) === e.target.value);
                  if (dev) {
                    setSelectedDevice(dev);
                  }
                }}
              >
                {devices.map(d => (
                  <option key={d.id} value={d.id} className="bg-gray-950 text-white">
                    {d.device_name || d.device_code} ({d.device_code})
                  </option>
                ))}
              </select>
            </div>

            {selectedDevice && (
              <div className="flex items-center gap-4 bg-gray-950/80 border border-gray-800 p-3 rounded-lg w-full md:w-auto self-stretch md:self-auto justify-center">
                <QRImage code={selectedDevice.device_code} qrCodeData={selectedDevice.qr_code} />
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-400">Automatic QR Code</p>
                  <p className="text-xs font-mono text-cyan-400">{selectedDevice.device_code}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          {selectedDevice && (
            <>
              <div className="flex border-b border-gray-800 mt-6">
                <button
                  onClick={() => setActiveTab('tracker')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tracker'
                    ? 'border-blue-500 text-blue-500 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Satellite className="w-4 h-4" />
                    Live GPS Tracker
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('route')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'route'
                    ? 'border-blue-500 text-blue-500 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Route History
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="mt-4 text-gray-800">
                {activeTab === 'tracker' ? (
                  <GPSTracker
                    deviceCode={selectedDevice.device_code}
                    deviceName={selectedDevice.device_name || undefined}
                    deviceM2mNumber={selectedDevice.device_m2m_number}
                    isTrackingActive={selectedDevice.is_active}
                    onToggleTracking={async (active) => {
                      setIsLoading(true);
                      try {
                        await api.devices.updateById(selectedDevice.id, { is_active: active });
                        toast({
                          title: 'Success',
                          description: `Tracking ${active ? 'started' : 'stopped'} successfully.`,
                        });
                        setSelectedDevice({ ...selectedDevice, is_active: active });
                        fetchMyDevices();
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'An unexpected error occurred.',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  />
                ) : (
                  <DeviceRouteMap
                    deviceCode={selectedDevice.device_code}
                    deviceName={selectedDevice.device_name || undefined}
                    height="500px"
                    showControls={true}
                    isTrackingActive={selectedDevice.is_active}
                    onToggleTracking={async (active) => {
                      setIsLoading(true);
                      try {
                        await api.devices.updateById(selectedDevice.id, { is_active: active });
                        toast({
                          title: 'Success',
                          description: `Tracking ${active ? 'started' : 'stopped'} successfully.`,
                        });
                        setSelectedDevice({ ...selectedDevice, is_active: active });
                        fetchMyDevices();
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'An unexpected error occurred.',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDevices;
