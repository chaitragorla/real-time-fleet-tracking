
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { QrCode, Scan, Plus, Camera, Video, VideoOff } from 'lucide-react';
import Webcam from 'react-webcam';
import { BrowserQRCodeReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import DeviceNameModal from './DeviceNameModal';

const QRScanner = () => {
  const { user } = useAuth();
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [isAllocating, setIsAllocating] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingDeviceCode, setPendingDeviceCode] = useState<string>('');
  const webcamRef = useRef<Webcam>(null);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);
  const scanningInterval = useRef<NodeJS.Timeout | null>(null);



  const startQRScanning = useCallback(() => {
    if (!webcamRef.current || !isCameraOn) return;

    setIsScanning(true);
    
    if (!codeReader.current) {
      codeReader.current = new BrowserQRCodeReader();
    }

    scanningInterval.current = setInterval(() => {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              try {
                // Get image data from the webcam canvas
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Create a new offscreen canvas for QR decoding
                const offCanvas = document.createElement('canvas');
                offCanvas.width = imageData.width;
                offCanvas.height = imageData.height;
                
                const offCtx = offCanvas.getContext('2d');
                if (offCtx) {
                  offCtx.putImageData(imageData, 0, 0);
                  
                  const reader = codeReader.current;
                  if (!reader) {
                    console.error("QR code reader not initialized");
                    return;
                  }

                  try {
                    const result = await reader.decodeFromCanvas(offCanvas);
                    if (result) {
                      const scannedCode = result.getText().trim();
                      stopQRScanning();
                      toast({
                        title: "QR Code Detected!",
                        description: `Device code: ${scannedCode}`,
                      });
                      allocateScannedDevice(scannedCode);
                    }
                  } catch (err) {
                    if (!(err instanceof NotFoundException)) {
                      console.error("QR scanning error:", err);
                    }
                  }
                }
              } catch (error) {
                console.error('Error processing image:', error);
              }
            }
          };
          img.src = imageSrc;
        }
      }
    }, 500); // Scan every 500ms
  }, [isCameraOn]);

  const stopQRScanning = useCallback(() => {
    setIsScanning(false);
    if (scanningInterval.current) {
      clearInterval(scanningInterval.current);
      scanningInterval.current = null;
    }
  }, []);

  const toggleCamera = useCallback(() => {
    setIsCameraOn(prev => {
      const newState = !prev;
      if (!newState) {
        stopQRScanning();
      }
      return newState;
    });
  }, [stopQRScanning]);

  useEffect(() => {
    if (isCameraOn && !isScanning) {
      // Start scanning automatically when camera is turned on
      const timer = setTimeout(() => {
        startQRScanning();
      }, 1000); // Wait 1 second for camera to initialize
      return () => clearTimeout(timer);
    }
  }, [isCameraOn, isScanning, startQRScanning]);

  useEffect(() => {
    return () => {
      stopQRScanning();
      if (codeReader.current) {
        codeReader.current = null;
      }
    };
  }, [stopQRScanning]);

  // Function to start GPS tracking for a device
  const startTrackingForDevice = async (deviceCode: string) => {
    try {
      // Set tracking state in localStorage to indicate tracking should start automatically
      localStorage.setItem(`gps_tracking_${deviceCode}`, JSON.stringify({
        isTracking: true,
        sessionStart: new Date().toISOString(),
        totalPoints: 0
      }));
      
      toast({
        title: "Tracking Started",
        description: `GPS tracking has been automatically started for device ${deviceCode}. You can stop it anytime from the device tracker.`,
      });
    } catch (error) {
      console.error('Error starting tracking for device:', error);
    }
  };

  const handleDeviceAllocation = async (deviceCode: string, deviceName?: string, deviceIcon?: string): Promise<boolean> => {
    try {
      if (!user) return false;
      
      await api.devices.claim(deviceCode, Number(user.id), deviceName, deviceIcon);
      toast({
        title: "Success",
        description: deviceName 
          ? `Device "${deviceName}" has been successfully added!`
          : `Device ${deviceCode} has been successfully allocated to you!`,
      });
      await startTrackingForDevice(deviceCode);
      return true;
    } catch (error) {
      console.error('Error allocating device:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleModalCancel = () => {
    // Reset the pending device code when user cancels
    setPendingDeviceCode('');
  };

  const allocateScannedDevice = async (scannedCode: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to allocate a device.",
        variant: "destructive",
      });
      return;
    }

    setIsAllocating(true);
    try {
      // First check if device exists and is not already allocated
      const { data: existingDevice } = await api.devices.getByCode(scannedCode);

      if (!existingDevice) {
        toast({
          title: "Error",
          description: "Device not found. Please check the device code.",
          variant: "destructive",
        });
        return;
      }

      if (existingDevice.allocated_to_customer_id) {
        // Check if the device is already allocated to the current user
        const deviceOwnerId = existingDevice.allocated_to_customer_id?.toString();
        const currentUserId = user.id?.toString();
        
        if (deviceOwnerId === currentUserId) {
          toast({
            title: "Already Added",
            description: "You have already added this device to your list.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Device Unavailable",
            description: "This device has been allocated to another user.",
            variant: "destructive",
          });
        }
        return;
      }

      // Show device naming modal without allocating yet
      setPendingDeviceCode(scannedCode);
      setShowNameModal(true);
    } catch (error) {
      console.error('Error allocating device:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const allocateDevice = async () => {
    if (!deviceCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a device code.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to allocate a device.",
        variant: "destructive",
      });
      return;
    }

    setIsAllocating(true);
    try {
      // First check if device exists and is not already allocated
      const { data: existingDevice } = await api.devices.getByCode(deviceCode.trim());

      if (!existingDevice) {
        toast({
          title: "Error",
          description: "Device not found. Please check the device code.",
          variant: "destructive",
        });
        return;
      }

      if (existingDevice.allocated_to_customer_id) {
        // Check if the device is already allocated to the current user
        const deviceOwnerId = existingDevice.allocated_to_customer_id?.toString();
        const currentUserId = user.id?.toString();
        
        if (deviceOwnerId === currentUserId) {
          toast({
            title: "Already Added",
            description: "You have already added this device to your list.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Device Unavailable",
            description: "This device has been allocated to another user.",
            variant: "destructive",
          });
        }
        return;
      }

      // Show device naming modal without allocating yet
      const currentDeviceCode = deviceCode;
      setDeviceCode('');
      setPendingDeviceCode(currentDeviceCode);
      setShowNameModal(true);
    } catch (error) {
      console.error('Error allocating device:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md mx-auto pt-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <QrCode className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Device</h1>
          <p className="text-gray-600">Scan QR code or enter device code</p>
        </div>

        {/* QR Scanner Area */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          {/* Scanner Viewfinder */}
          <div className="relative bg-black aspect-square flex items-center justify-center">
            {isCameraOn ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                  width: 640,
                  height: 640,
                  facingMode: "environment"
                }}
              />
            ) : (
              <div className="relative w-64 h-64 border-2 border-white/30 rounded-lg">
                {/* Corner indicators */}
                <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-blue-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-blue-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-blue-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-blue-500 rounded-br-lg"></div>
                
                {/* Center QR icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-white/50" />
                </div>
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 animate-pulse"></div>
              </div>
            )}
            
            {/* Camera toggle button */}
            <div className="absolute bottom-4 right-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-black/30 text-white hover:bg-black/50"
                onClick={toggleCamera}
              >
                {isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-2">
              {isCameraOn ? (
                isScanning ? "Scanning for QR codes..." : "Camera is active - position QR code in frame"
              ) : "Turn on camera to scan QR codes"}
            </p>
            {isScanning && (
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-600 font-medium">Scanning...</span>
              </div>
            )}
            <Button 
              onClick={toggleCamera}
              className={`w-full mb-4 ${isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isCameraOn ? (
                <>
                  <VideoOff className="w-4 h-4 mr-2" />
                  Turn Off Camera
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Turn On Camera
                </>
              )}
            </Button>
            {isCameraOn && (
              <Button 
                onClick={isScanning ? stopQRScanning : startQRScanning}
                variant="outline"
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <VideoOff className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4 mr-2" />
                    Start QR Scan
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Manual Entry */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="text-center mb-4">
            <p className="text-gray-700 font-medium">Enter Device Code Manually</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="deviceCode" className="text-sm font-medium text-gray-700">
                Device Code
              </Label>
              <Input
                id="deviceCode"
                type="text"
                placeholder="Enter 16-character code"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value.toUpperCase())}
                maxLength={16}
                className="font-mono text-center text-lg tracking-wider mt-2 h-12"
              />
            </div>

            <Button 
              onClick={allocateDevice}
              disabled={isAllocating || !deviceCode.trim()}
              className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              {isAllocating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Adding Device...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Add Device
                </>
              )}
            </Button>
          </div>
        </div>



        {/* Help Section */}
        <div className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            How to add a device
          </h3>
          <ol className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
              Turn on camera to scan QR codes directly
            </li>
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
              Enter device code manually if you have one
            </li>
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</span>
              The device will be allocated to your account
            </li>
          </ol>
        </div>
      </div>
      
      {/* Device Name Modal */}
      <DeviceNameModal
        isOpen={showNameModal}
        onClose={() => {
          setShowNameModal(false);
          setPendingDeviceCode('');
        }}
        deviceCode={pendingDeviceCode}
        onAllocateDevice={handleDeviceAllocation}
        onCancel={handleModalCancel}
        onSuccess={() => {
          // Refresh the page to update device lists
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }}
      />
    </div>
  );
};

export default QRScanner;
