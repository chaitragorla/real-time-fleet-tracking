 
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { QrCode, RefreshCw, Trash2, Eye, EyeOff, Edit } from 'lucide-react';
import QRCode from 'qrcode';
import ConfirmationDialog from './ConfirmationDialog';

interface Device {
  id: number;
  device_code: string;
  qr_code: string;
  created_at: string;
  is_active: boolean;
  allocated_to_customer_id: number | null;
  allocated_to_customer_name: string | null;
  allocated_at: string | null;
  device_m2m_number: string | null;
}

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceCount, setDeviceCount] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodes, setQrCodes] = useState<{[key: string]: string}>({});
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    deviceId: number | null;
    deviceCode: string;
  }>({
    open: false,
    deviceId: null,
    deviceCode: ''
  });
  const [editingM2MId, setEditingM2MId] = useState<number | null>(null);
  const [editingM2MNumber, setEditingM2MNumber] = useState<string>('');
  const [showM2MNumbers, setShowM2MNumbers] = useState<{[key: number]: boolean}>({});
  const [isUpdatingM2M, setIsUpdatingM2M] = useState(false);

  const generateDeviceCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateQRCodeDataURL = async (deviceCode: string): Promise<string> => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(deviceCode, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.devices.list();
      setDevices(data || []);
      const qrCodeMap: {[key: string]: string} = {};
      for (const device of data || []) {
        const qrDataURL = device.qr_code?.startsWith('data:image')
          ? device.qr_code
          : await generateQRCodeDataURL(device.device_code);
        qrCodeMap[device.device_code] = qrDataURL;
      }
      setQrCodes(qrCodeMap);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch devices.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateDevices = async () => {
    const count = parseInt(deviceCount);
    if (!count || count < 1) {
      toast({
        title: "Error",
        description: "Please enter a valid number of devices to generate.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const newDevices = [];
      for (let i = 0; i < count; i++) {
        const deviceCode = generateDeviceCode();
        const qrCode = await generateQRCodeDataURL(deviceCode);
        
        newDevices.push({
          device_code: deviceCode,
          qr_code: qrCode,
          is_active: true
        });
      }

      await api.devices.create({ devices: newDevices });
      toast({
        title: "Success",
        description: `${count} device(s) generated successfully.`,
      });
      fetchDevices();
      setDeviceCount('');
    } catch (error) {
      console.error('Error generating devices:', error);
      toast({
        title: "Error",
        description: "Failed to generate devices.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteClick = (deviceId: number, deviceCode: string) => {
    setDeleteDialog({
      open: true,
      deviceId,
      deviceCode
    });
  };

  const handleM2MEdit = (device: Device) => {
    setEditingM2MId(device.id);
    setEditingM2MNumber(device.device_m2m_number || '');
  };

  const handleM2MSave = async (deviceId: number) => {
    if (editingM2MNumber && (editingM2MNumber.length !== 13 || !/^[0-9]+$/.test(editingM2MNumber))) {
      toast({
        title: "Error",
        description: "M2M number must be exactly 13 digits.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingM2M(true);
    try {
      await api.devices.updateById(deviceId, { device_m2m_number: editingM2MNumber.trim() || null });
      toast({
        title: "Success",
        description: "M2M number updated successfully.",
      });
      fetchDevices();
      setEditingM2MId(null);
      setEditingM2MNumber('');
    } catch (error) {
      console.error('Error updating M2M number:', error);
      toast({
        title: "Error",
        description: "Failed to update M2M number.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingM2M(false);
    }
  };

  const handleM2MCancel = () => {
    setEditingM2MId(null);
    setEditingM2MNumber('');
  };

  const toggleM2MVisibility = (deviceId: number | string) => {
    setShowM2MNumbers(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const confirmDelete = async () => {
    if (!deleteDialog.deviceId) return;

    try {
      await api.devices.deleteById(deleteDialog.deviceId);
      toast({
        title: "Success",
        description: "Device deleted successfully.",
      });
      fetchDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: "Error",
        description: "Failed to delete device.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false, deviceId: null, deviceCode: '' });
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const takenDevices = devices.filter(device => device.allocated_to_customer_id !== null);
  const notTakenDevices = devices.filter(device => device.allocated_to_customer_id === null);

  const DeviceTable = ({ devices: deviceList, title, showAllocation = false }: { devices: Device[], title: string, showAllocation?: boolean }) => (
    <Card className="bg-gray-900/40 border-gray-800 shadow-xl backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <QrCode className="w-5 h-5 text-violet-400" />
          {title} ({deviceList.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400 font-semibold">Device Code</TableHead>
                <TableHead className="text-gray-400 font-semibold">M2M Number</TableHead>
                <TableHead className="text-gray-400 font-semibold">Status</TableHead>
                <TableHead className="text-gray-400 font-semibold">Created At</TableHead>
                {showAllocation && <TableHead className="text-gray-400 font-semibold">Allocated To</TableHead>}
                {showAllocation && <TableHead className="text-gray-400 font-semibold">Allocated At</TableHead>}
                <TableHead className="text-center text-gray-400 font-semibold">QR Code</TableHead>
                <TableHead className="text-gray-400 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceList.map((device) => (
                <TableRow key={device.id} className="border-b border-gray-800 hover:bg-gray-950/20">
                  <TableCell className="font-mono text-sm text-cyan-400">{device.device_code}</TableCell>
                  <TableCell>
                    {editingM2MId === device.id ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            type={showM2MNumbers[`editing-${device.id}`] ? "text" : "password"}
                            value={editingM2MNumber}
                            onChange={(e) => setEditingM2MNumber(e.target.value)}
                            placeholder="Enter 13-digit M2M number"
                            className="w-48 font-mono text-sm pr-10 bg-gray-950/40 border-gray-700 text-white"
                            maxLength={13}
                            autoFocus
                            key={`m2m-input-${device.id}`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleM2MVisibility(`editing-${device.id}`)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 mr-3 text-gray-400 hover:text-white"
                          >
                            {showM2MNumbers[`editing-${device.id}`] ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleM2MSave(device.id)}
                            disabled={isUpdatingM2M}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleM2MCancel}
                            disabled={isUpdatingM2M}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="font-mono text-sm text-gray-300">
                            {device.device_m2m_number ? (
                              showM2MNumbers[device.id] ? 
                                device.device_m2m_number : 
                                '••••••••••••'
                            ) : (
                              <span className="text-gray-500">Not set</span>
                            )}
                          </span>
                          {device.device_m2m_number && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleM2MVisibility(device.id)}
                              className="ml-2 h-6 w-6 p-0 text-gray-400 hover:text-white"
                            >
                              {showM2MNumbers[device.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleM2MEdit(device)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider border ${
                      device.is_active 
                        ? 'bg-green-500/10 text-green-400 border-green-500/25' 
                        : 'bg-red-500/10 text-red-400 border-red-500/25'
                    }`}>
                      {device.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(device.created_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  {showAllocation && (
                    <TableCell className="font-medium text-white">
                      {device.allocated_to_customer_name || <span className="text-gray-500">N/A</span>}
                    </TableCell>
                  )}
                  {showAllocation && (
                    <TableCell className="text-gray-300">
                      {device.allocated_at 
                        ? new Date(device.allocated_at).toLocaleDateString('en-IN')
                        : <span className="text-gray-500">N/A</span>
                      }
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col items-center gap-2">
                      {qrCodes[device.device_code] ? (
                        <img 
                          src={qrCodes[device.device_code]} 
                          alt={`QR Code for ${device.device_code}`}
                          className="border border-gray-700 rounded bg-white p-1 w-[100px] h-[100px]"
                        />
                      ) : (
                        <div className="w-[100px] h-[100px] border border-gray-700 rounded flex items-center justify-center bg-gray-800">
                          <span className="text-gray-500 text-xs">Loading...</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-500 font-mono">
                        Scan to get: {device.device_code}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(device.id, device.device_code)}
                      className="text-red-400 hover:text-red-500 border-gray-800 hover:bg-gray-950 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {deviceList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 font-medium">No {title.toLowerCase()} devices found.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className="bg-gray-900/40 border-gray-800 shadow-xl backdrop-blur-md mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <QrCode className="w-5 h-5 text-violet-400" />
            Device Management
          </CardTitle>
          <CardDescription className="text-gray-400">
            Generate and manage devices with QR codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="deviceCount" className="text-gray-300">Number of Devices to Generate</Label>
              <Input
                id="deviceCount"
                type="number"
                min="1"
                max="100"
                value={deviceCount}
                onChange={(e) => setDeviceCount(e.target.value)}
                placeholder="1"
                className="bg-gray-950/40 border-gray-700 text-white focus-visible:ring-violet-500"
              />
            </div>
            <Button 
              onClick={generateDevices}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Devices'}
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Device Overview</h3>
            <Button 
              onClick={fetchDevices}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="border-gray-800 hover:bg-gray-950 text-gray-300 rounded-xl"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="not-taken" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-950/60 p-1 border border-gray-800 rounded-lg">
          <TabsTrigger 
            value="not-taken"
            className="rounded-md py-2 data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 font-medium"
          >
            Not Taken Devices
          </TabsTrigger>
          <TabsTrigger 
            value="taken"
            className="rounded-md py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black text-gray-400 font-medium"
          >
            Taken Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="not-taken">
          <DeviceTable devices={notTakenDevices} title="Not Taken Devices" showAllocation={false} />
        </TabsContent>

        <TabsContent value="taken">
          <DeviceTable devices={takenDevices} title="Taken Devices" showAllocation={true} />
        </TabsContent>
      </Tabs>

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title="Delete Device"
        description={`Are you sure you want to delete device "${deleteDialog.deviceCode}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete Device"
      />
    </>
  );
};

export default DeviceManagement;
