import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Smartphone, X } from 'lucide-react';
import { IconSelector } from './IconSelector';

interface DeviceNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceCode: string;
  onSuccess: () => void;
  onCancel?: () => void;
  onAllocateDevice: (deviceCode: string, deviceName?: string, deviceIcon?: string) => Promise<boolean>;
}

const DeviceNameModal: React.FC<DeviceNameModalProps> = ({
  isOpen,
  onClose,
  deviceCode,
  onSuccess,
  onCancel,
  onAllocateDevice
}) => {
  const [deviceName, setDeviceName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('car');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deviceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a device name.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAllocateDevice(deviceCode, deviceName.trim(), selectedIcon);
      if (success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error saving device:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onAllocateDevice(deviceCode);
      if (success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error allocating device:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setDeviceName('');
      setSelectedIcon('car');
      if (onCancel) {
        onCancel();
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <Card className="relative w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Name Your Device</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>
            Give your device a memorable name for easy identification.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-code" className="text-sm font-medium">
                Device Code
              </Label>
              <Input
                id="device-code"
                value={deviceCode}
                disabled
                className="font-mono text-sm bg-gray-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="device-name" className="text-sm font-medium">
                Device Name *
              </Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., My Car GPS, Office Tracker..."
                disabled={isSubmitting}
                maxLength={50}
                className="focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                {deviceName.length}/50 characters
              </p>
            </div>
            
            <IconSelector
              selectedIcon={selectedIcon}
              onIconSelect={setSelectedIcon}
              className="pt-2"
            />
            
            <div className="space-y-3 pt-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Adding...' : 'Skip'}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !deviceName.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? 'Saving...' : 'Save Name'}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="w-full text-gray-600 hover:text-gray-800"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceNameModal;
