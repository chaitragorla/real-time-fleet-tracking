import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  QrCode,
  Scan,
  Plus,
  Camera,
  Video,
  VideoOff,
  Satellite,
  MapPin,
} from "lucide-react";
import Webcam from "react-webcam";
import { BrowserQRCodeReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import DeviceNameModal from "./DeviceNameModal";
import GPSTracker from "./GPSTracker";
import SimulatorMap from "./SimulatorMap";
import DeviceRouteMap from "./DeviceRouteMap";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapContainer,
  TileLayer,
  Marker,
  Rectangle,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getGeofenceOffsets, createCustomMarkerIcon } from "@/utils/iconUtils";

// Map updater to center the preview map dynamically
const PreviewMapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15, { animate: true });
  }, [center, map]);
  return null;
};

const QRImage: React.FC<{ code: string; qrCodeData?: string | null }> = ({
  code,
  qrCodeData,
}) => {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (qrCodeData?.startsWith("data:image")) {
      setSrc(qrCodeData);
    } else {
      QRCode.toDataURL(code, {
        width: 120,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then(setSrc)
        .catch((err) => console.error("Error generating QR code:", err));
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
      className="w-16 h-16 border border-gray-300 rounded bg-white p-1"
    />
  );
};

const QRScanner = () => {
  const { user } = useAuth();
  const [deviceCode, setDeviceCode] = useState<string>("");
  const [isAllocating, setIsAllocating] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(() => {
    return localStorage.getItem("login_mode") === "user";
  });

  const [isScanning, setIsScanning] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingDeviceCode, setPendingDeviceCode] = useState<string>("");

  // Custom states for completed QR scanned / parking slot validation
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [scannedDeviceDetails, setScannedDeviceDetails] = useState<any>(null);
  // Animation & Scoring states
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [animVehiclePos, setAnimVehiclePos] = useState<[number, number] | null>(
    null,
  );
  const [animTargetPos, setAnimTargetPos] = useState<[number, number] | null>(
    null,
  );
  const [animBounds, setAnimBounds] = useState<[number, number][] | null>(null);
  const [animMapCenter, setAnimMapCenter] = useState<[number, number] | null>(
    null,
  );
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [isInsideBox, setIsInsideBox] = useState(true);
  const [parkingScore, setParkingScore] = useState(100);
  const [scoreComment, setScoreComment] = useState("");
  const [deviceStartLocation, setDeviceStartLocation] = useState<
    [number, number] | null
  >(null);
  const [selectedParking, setSelectedParking] = useState<string>("");

  // GPS Simulator live-tracking overlay
  const [showSimulatorMap, setShowSimulatorMap] = useState(false);
  const [simulatorDeviceCode, setSimulatorDeviceCode] = useState<string>("");

  const markerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);
  const scanningInterval = useRef<NodeJS.Timeout | null>(null);

  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"tracker" | "route">("route");

  const fetchMyDevices = async () => {
    if (!user) return;
    try {
      const { data } = await api.devices.byOwner(user.id);
      setDevices(data || []);
      if (data && data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0]);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };

  useEffect(() => {
    fetchMyDevices();
  }, [user]);

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
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);

              try {
                // Get image data from the webcam canvas
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );

                // Create a new offscreen canvas for QR decoding
                const offCanvas = document.createElement("canvas");
                offCanvas.width = imageData.width;
                offCanvas.height = imageData.height;

                const offCtx = offCanvas.getContext("2d");
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
                console.error("Error processing image:", error);
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
    setIsCameraOn((prev) => {
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
      localStorage.setItem(
        `gps_tracking_${deviceCode}`,
        JSON.stringify({
          isTracking: true,
          sessionStart: new Date().toISOString(),
          totalPoints: 0,
        }),
      );

      toast({
        title: "Tracking Started",
        description: `GPS tracking has been automatically started for device ${deviceCode}. You can stop it anytime from the device tracker.`,
      });
    } catch (error) {
      console.error("Error starting tracking for device:", error);
    }
  };

  const handleDeviceAllocation = async (
    deviceCode: string,
    deviceName?: string,
    deviceIcon?: string,
  ): Promise<boolean> => {
    try {
      if (!user) return false;

      await api.devices.claim(
        deviceCode,
        Number(user.id),
        deviceName,
        deviceIcon,
      );
      toast({
        title: "Success",
        description: deviceName
          ? `Device "${deviceName}" has been successfully added!`
          : `Device ${deviceCode} has been successfully allocated to you!`,
      });
      await startTrackingForDevice(deviceCode);
      return true;
    } catch (error) {
      console.error("Error allocating device:", error);
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
    setPendingDeviceCode("");
  };

  const isUserMode = localStorage.getItem("login_mode") === "user";

  const handleParkVehicle = async (parkingPlace: string) => {
    if (!scannedDeviceDetails || !parkingPlace) {
      toast({
        title: "Error",
        description: "Please select a parking location.",
        variant: "destructive",
      });
      return;
    }

    setSelectedParking(parkingPlace);

    try {
      setIsAllocating(true);
      // Fetch device GPS history to get start coordinate
      const { data: gpsPoints } = await api.gps.deviceData(
        scannedDeviceDetails.device_code,
      );
      const sortedPoints = [...(gpsPoints || [])].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const startPoint = sortedPoints[0];
      const startLat = startPoint ? startPoint.latitude : 12.9748;
      const startLng = startPoint ? startPoint.longitude : 77.5857;

      let targetLat = startLat;
      let targetLng = startLng;

      if (parkingPlace === "HOME") {
        targetLat = startLat + 0.001;
        targetLng = startLng + 0.001;
      } else if (parkingPlace === "COLLEGE") {
        targetLat = startLat - 0.001;
        targetLng = startLng + 0.001;
      } else if (parkingPlace === "OFFICE") {
        targetLat = startLat - 0.001;
        targetLng = startLng - 0.001;
      }

      const details = getSelectedGeofenceDetails(parkingPlace);
      if (!details) return;

      const pBounds = details.bounds;

      // Start the vehicle slightly offset from the target geofence box center,
      // so the user has to manually adjust and move it into the square.
      const initialLat = targetLat - 0.0007;
      const initialLng = targetLng - 0.0007;

      setShowParkingModal(false);
      setAnimVehiclePos([initialLat, initialLng]);
      setAnimTargetPos([targetLat, targetLng]);
      setAnimBounds(pBounds);
      setAnimMapCenter([targetLat, targetLng]);
      setShowAnimationModal(true);
      setShowSuccessAlert(false);
    } catch (error) {
      console.error("Error starting parking adjustment:", error);
      toast({
        title: "Error",
        description: "Failed to load parking workspace.",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const nudgeVehicle = (direction: "up" | "down" | "left" | "right") => {
    if (!animVehiclePos) return;
    const [lat, lng] = animVehiclePos;
    const step = 0.0001; // Nudge step in degrees

    if (direction === "up") setAnimVehiclePos([lat + step, lng]);
    if (direction === "down") setAnimVehiclePos([lat - step, lng]);
    if (direction === "left") setAnimVehiclePos([lat, lng - step]);
    if (direction === "right") setAnimVehiclePos([lat, lng + step]);
  };

  const handleVerifyParking = async () => {
    if (
      !animVehiclePos ||
      !animTargetPos ||
      !animBounds ||
      !scannedDeviceDetails
    )
      return;

    const [vehicleLat, vehicleLng] = animVehiclePos;
    const [targetLat, targetLng] = animTargetPos;
    const pBounds = animBounds;

    // Check if inside bounds
    const isInside =
      vehicleLat >= pBounds[0][0] &&
      vehicleLat <= pBounds[1][0] &&
      vehicleLng >= pBounds[0][1] &&
      vehicleLng <= pBounds[1][1];

    // Calculate score based on distance to the center
    const distanceToCenter = Math.sqrt(
      Math.pow(vehicleLat - targetLat, 2) + Math.pow(vehicleLng - targetLng, 2),
    );
    const diagonal = Math.sqrt(
      Math.pow(pBounds[1][0] - pBounds[0][0], 2) +
        Math.pow(pBounds[1][1] - pBounds[0][1], 2),
    );
    const rawScore = Math.max(
      0,
      100 - (distanceToCenter / (diagonal / 2)) * 100,
    );
    const score = Math.round(
      isInside ? Math.max(70, rawScore) : Math.min(55, rawScore),
    );

    let comment = "";
    if (isInside) {
      if (score >= 90) {
        comment = `🎉 Perfect Parking! Score: ${score}/100. Excellent job placing the vehicle exactly in the center of the slot!`;
      } else {
        comment = `👍 Correctly Parked! Score: ${score}/100. The vehicle is safely inside the geofence slot.`;
      }
    } else {
      comment = `⚠️ Wrongly Parked! Score: ${score}/100. The vehicle is outside the designated parking zone bounds! Please try to adjust it closer to the center.`;
    }

    setIsInsideBox(isInside);
    setParkingScore(score);
    setScoreComment(comment);

    try {
      // Save location to backend
      await api.gps.updateLocation({
        device_code: scannedDeviceDetails.device_code,
        device_m2m_number:
          scannedDeviceDetails.device_m2m_number || "",
        latitude: vehicleLat,
        longitude: vehicleLng,
        timestamp: new Date().toISOString(),
      });
      fetchMyDevices();
      setShowSuccessAlert(true);
    } catch (error) {
      console.error("Error saving parked location:", error);
      toast({
        title: "Error",
        description: "Failed to save parked location.",
        variant: "destructive",
      });
    }
  };

  const fetchStartLocation = async (deviceCode: string) => {
    try {
      const { data: gpsPoints } = await api.gps.deviceData(deviceCode);
      const sortedPoints = [...(gpsPoints || [])].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const startPoint = sortedPoints[0];
      if (startPoint) {
        setDeviceStartLocation([startPoint.latitude, startPoint.longitude]);
      } else {
        setDeviceStartLocation([12.9748, 77.5857]); // Fallback to Bangalore
      }
    } catch (error) {
      console.error("Error fetching start location:", error);
      setDeviceStartLocation([12.9748, 77.5857]);
    }
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

      if (isUserMode) {
        // Device must already be claimed by this customer (added from Dashboard)
        if (!existingDevice.allocated_to_customer_id) {
          toast({
            title: "Device Not Added",
            description: "Please add this device from your Dashboard first before scanning it here.",
            variant: "destructive",
          });
          return;
        }

        // Check if device belongs to this customer or is shared with them
        const isOwner = existingDevice.allocated_to_customer_id?.toString() === user?.id?.toString();
        let isShared = false;

        if (!isOwner && user?.id) {
          try {
            const { data: sharedList } = await api.devices.received(user.id);
            isShared = (sharedList || []).some(
              (share: any) => share.device?.device_code === existingDevice.device_code
            );
          } catch (err) {
            console.error("Error checking shared devices:", err);
          }
        }

        if (!isOwner && !isShared) {
          toast({
            title: "Access Denied",
            description: "This device belongs to another customer. You do not have permission to view its trip details.",
            variant: "destructive",
          });
          return;
        }

        // Owner or shared — show trip map + geofencing
        setScannedDeviceDetails(existingDevice);
        setSimulatorDeviceCode(existingDevice.device_code);
        setShowSimulatorMap(true);
        return;
      }

      if (existingDevice.is_active) {
        toast({
          title: "Unable to scan",
          description: "Trip is active and unable to scan.",
          variant: "destructive",
        });
        return;
      }

      if (existingDevice.allocated_to_customer_id) {
        const deviceOwnerId =
          existingDevice.allocated_to_customer_id?.toString();
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

      setPendingDeviceCode(scannedCode);
      setShowNameModal(true);
    } catch (error) {
      console.error("Error allocating device:", error);
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
      const { data: existingDevice } = await api.devices.getByCode(
        deviceCode.trim(),
      );

      if (!existingDevice) {
        toast({
          title: "Error",
          description: "Device not found. Please check the device code.",
          variant: "destructive",
        });
        return;
      }

      if (isUserMode) {
        // Device must already be claimed by this customer (added from Dashboard)
        if (!existingDevice.allocated_to_customer_id) {
          toast({
            title: "Device Not Added",
            description: "Please add this device from your Dashboard first before scanning it here.",
            variant: "destructive",
          });
          return;
        }

        // Check if device belongs to this customer or is shared with them
        const isOwner = existingDevice.allocated_to_customer_id?.toString() === user?.id?.toString();
        let isShared = false;

        if (!isOwner && user?.id) {
          try {
            const { data: sharedList } = await api.devices.received(user.id);
            isShared = (sharedList || []).some(
              (share: any) => share.device?.device_code === existingDevice.device_code
            );
          } catch (err) {
            console.error("Error checking shared devices:", err);
          }
        }

        if (!isOwner && !isShared) {
          toast({
            title: "Access Denied",
            description: "This device belongs to another customer. You do not have permission to view its trip details.",
            variant: "destructive",
          });
          return;
        }

        // Owner or shared — show trip map + geofencing
        setScannedDeviceDetails(existingDevice);
        setSimulatorDeviceCode(existingDevice.device_code);
        setShowSimulatorMap(true);
        setDeviceCode("");
        return;
      }

      if (existingDevice.is_active) {
        toast({
          title: "Unable to scan",
          description: "Trip is active and unable to scan.",
          variant: "destructive",
        });
        return;
      }

      if (existingDevice.allocated_to_customer_id) {
        const deviceOwnerId =
          existingDevice.allocated_to_customer_id?.toString();
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

      const currentDeviceCode = deviceCode;
      setDeviceCode("");
      setPendingDeviceCode(currentDeviceCode);
      setShowNameModal(true);
    } catch (error) {
      console.error("Error allocating device:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const getSelectedGeofenceDetails = (parkingPlace?: string) => {
    const activeParking = parkingPlace || selectedParking;
    if (!scannedDeviceDetails || !deviceStartLocation || !activeParking)
      return null;
    const [startLat, startLng] = deviceStartLocation;
    const offsets = getGeofenceOffsets(scannedDeviceDetails.device_icon);

    let bounds: [number, number][] = [];
    let center: [number, number] = [startLat, startLng];

    if (activeParking === "HOME") {
      bounds = [
        [startLat + offsets.home[0][0], startLng + offsets.home[0][1]],
        [startLat + offsets.home[1][0], startLng + offsets.home[1][1]],
      ];
      center = [
        startLat + offsets.centerOffset.HOME[0],
        startLng + offsets.centerOffset.HOME[1],
      ];
    } else if (activeParking === "COLLEGE") {
      bounds = [
        [startLat + offsets.college[0][0], startLng + offsets.college[0][1]],
        [startLat + offsets.college[1][0], startLng + offsets.college[1][1]],
      ];
      center = [
        startLat + offsets.centerOffset.COLLEGE[0],
        startLng + offsets.centerOffset.COLLEGE[1],
      ];
    } else if (activeParking === "OFFICE") {
      bounds = [
        [startLat + offsets.office[0][0], startLng + offsets.office[0][1]],
        [startLat + offsets.office[1][0], startLng + offsets.office[1][1]],
      ];
      center = [
        startLat + offsets.centerOffset.OFFICE[0],
        startLng + offsets.centerOffset.OFFICE[1],
      ];
    }

    return { bounds, center };
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
                  facingMode: "environment",
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
                {isCameraOn ? (
                  <VideoOff className="w-5 h-5" />
                ) : (
                  <Video className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-2">
              {isCameraOn
                ? isScanning
                  ? "Scanning for QR codes..."
                  : "Camera is active - position QR code in frame"
                : "Turn on camera to scan QR codes"}
            </p>
            {isScanning && (
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-600 font-medium">
                  Scanning...
                </span>
              </div>
            )}
            <Button
              onClick={toggleCamera}
              className={`w-full mb-4 ${isCameraOn ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
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
            <p className="text-gray-700 font-medium">
              Enter Device Code Manually
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label
                htmlFor="deviceCode"
                className="text-sm font-medium text-gray-700"
              >
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

        {/* Testing / Demo Section */}
        <TestDevicesPanel onSelectCode={(code) => setDeviceCode(code)} />

        {/* Help Section */}
        <div className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            How to add a device
          </h3>
          <ol className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                1
              </span>
              Turn on camera to scan QR codes directly
            </li>
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                2
              </span>
              Enter device code manually if you have one
            </li>
            <li className="flex items-start">
              <span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                3
              </span>
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
          setPendingDeviceCode("");
        }}
        deviceCode={pendingDeviceCode}
        onAllocateDevice={handleDeviceAllocation}
        onCancel={handleModalCancel}
        onSuccess={async () => {
          try {
            const { data } = await api.devices.byOwner(user?.id);
            setDevices(data || []);
            const newDevice = (data || []).find(
              (d) => d.device_code === pendingDeviceCode,
            );
            if (newDevice) {
              setSelectedDevice(newDevice);
              toast({
                title: "Device Added",
                description: `Successfully added and selected ${newDevice.device_name || newDevice.device_code}`,
              });
            } else if (data && data.length > 0) {
              setSelectedDevice(data[0]);
            }
          } catch (e) {
            console.error(e);
          }
          setShowNameModal(false);
          setPendingDeviceCode("");
        }}
      />

      {/* Active Vehicle Tracking Card */}
      {selectedDevice && (
        <div className="max-w-4xl mx-auto mt-8 px-4 pb-12">
          <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-500" />
                Active Vehicle Tracking
              </CardTitle>
              <CardDescription className="text-gray-400">
                Live location check and parking slot validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dropdown & QR Code */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-950 p-4 border border-gray-800 rounded-xl">
                <div className="flex-1 w-full">
                  <label className="text-xs font-semibold text-gray-400 block mb-1">
                    Select Vehicle
                  </label>
                  <select
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-medium"
                    value={selectedDevice.id}
                    onChange={(e) => {
                      const dev = devices.find(
                        (d) => String(d.id) === e.target.value,
                      );
                      if (dev) setSelectedDevice(dev);
                    }}
                  >
                    {devices.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        className="bg-gray-900 text-white animate-none"
                      >
                        {d.device_name || d.device_code} ({d.device_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg border border-gray-800 justify-center w-full animate-none">
                    <QRImage
                      code={selectedDevice.device_code}
                      qrCodeData={selectedDevice.qr_code}
                    />
                    <div className="text-left animate-none">
                      <p className="text-xs font-bold text-gray-400">
                        Automatic QR Code
                      </p>
                      <p className="text-xs font-mono text-cyan-400">
                        {selectedDevice.device_code}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSimulatorDeviceCode(selectedDevice.device_code);
                      setShowSimulatorMap(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm py-2"
                  >
                    🚗 Track Live
                  </Button>
                </div>
              </div>

              {/* Tabs for Live / History */}
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("tracker")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "tracker"
                      ? "border-blue-500 text-blue-400 font-semibold"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Live GPS Tracker
                </button>
                <button
                  onClick={() => setActiveTab("route")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "route"
                      ? "border-blue-500 text-blue-400 font-semibold"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Route History
                </button>
              </div>

              {/* Render Map & Tracking */}
              <div className="mt-4 text-gray-800">
                {activeTab === "tracker" ? (
                  <GPSTracker
                    deviceCode={selectedDevice.device_code}
                    deviceName={selectedDevice.device_name || undefined}
                    deviceM2mNumber={selectedDevice.device_m2m_number}
                    isTrackingActive={selectedDevice.is_active}
                    onToggleTracking={async (active) => {
                      try {
                        await api.devices.updateById(selectedDevice.id, {
                          is_active: active,
                        });
                        setSelectedDevice({
                          ...selectedDevice,
                          is_active: active,
                        });
                        fetchMyDevices();
                      } catch (error) {
                        console.error("Error toggling tracking:", error);
                      }
                    }}
                  />
                ) : (
                  <DeviceRouteMap
                    deviceCode={selectedDevice.device_code}
                    deviceName={selectedDevice.device_name || undefined}
                    height="450px"
                    showControls={true}
                    isTrackingActive={selectedDevice.is_active}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Trip Warning Dialog */}
      <Dialog open={showActiveWarning} onOpenChange={setShowActiveWarning}>
        <DialogContent className="bg-gray-900 border border-gray-800 text-white max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-500">
              <span>⚠️ Trip in Progress</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-2">
              The device is still not reached destination. Please try again
              after the trip is completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setShowActiveWarning(false)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completed Trip / Parking Selection Dialog */}
      <Dialog
        open={showParkingModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowParkingModal(false);
            setScannedDeviceDetails(null);
          }
        }}
      >
        <DialogContent className="bg-gray-900 border border-gray-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <span>🚗 Vehicle Details & Parking Options</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Trip completed successfully. View vehicle details and select
              parking spot.
            </DialogDescription>
          </DialogHeader>

          {scannedDeviceDetails && (
            <div className="space-y-6 mt-4">
              {/* Vehicle Details */}
              <div className="bg-gray-950 p-4 border border-gray-800 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">
                    Device Name:
                  </span>
                  <span className="text-white font-bold">
                    {scannedDeviceDetails.device_name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">
                    Device Code:
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {scannedDeviceDetails.device_code}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">M2M Number:</span>
                  <span className="text-gray-300">
                    {scannedDeviceDetails.device_m2m_number || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">
                    Associated Owner:
                  </span>
                  <span className="text-gray-300">
                    {scannedDeviceDetails.allocated_to_customer_name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Status:</span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                    Completed
                  </span>
                </div>
              </div>

              {/* Parking Selection */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-300 block text-center">
                  Select Parking Location to Start Driving:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "HOME", icon: "🏠", label: "Home" },
                    { id: "COLLEGE", icon: "🏫", label: "College" },
                    { id: "OFFICE", icon: "🏢", label: "Office" },
                  ].map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleParkVehicle(place.id)}
                      className="py-4 px-2 rounded-2xl border bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 hover:border-blue-500 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2"
                    >
                      <span className="text-3xl">{place.icon}</span>
                      <span className="font-bold text-sm">{place.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowParkingModal(false);
                setScannedDeviceDetails(null);
              }}
              className="w-full bg-transparent border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-screen Animation Modal with Score Comment */}
      <Dialog open={showAnimationModal} onOpenChange={() => {}}>
        <DialogContent
          className="bg-gray-950 border border-gray-800 text-white w-[98vw] max-w-4xl rounded-2xl p-0 overflow-y-scroll overscroll-contain"
          style={{ maxHeight: "90vh" }}
        >
          <div className="p-5 border-b border-gray-800 flex justify-between items-center">
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <span>🚗</span> Adjust & Park Your Vehicle
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                Drag the vehicle marker or use arrow buttons to place the
                vehicle inside the green parking box.
              </DialogDescription>
            </div>
            {showSuccessAlert && (
              <div
                className={`px-4 py-1.5 rounded-full text-sm font-bold border ${isInsideBox ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}
              >
                Score: {parkingScore}/100
              </div>
            )}
          </div>
          <div
            className="relative"
            style={{ height: "45vh", minHeight: "280px" }}
          >
            {animVehiclePos && animTargetPos && animBounds && animMapCenter && (
              <MapContainer
                center={animMapCenter}
                zoom={16}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <PreviewMapUpdater center={animMapCenter} />
                {/* Geofence rectangle */}
                <Rectangle
                  bounds={animBounds}
                  pathOptions={{
                    color:
                      isInsideBox && showSuccessAlert ? "#10B981" : "#3B82F6",
                    weight: 3,
                    dashArray: "8, 4",
                    fillColor:
                      isInsideBox && showSuccessAlert ? "#10B981" : "#3B82F6",
                    fillOpacity: 0.15,
                  }}
                >
                  <Tooltip
                    permanent
                    direction="center"
                    className="bg-transparent border-none shadow-none font-bold text-blue-400 text-base"
                  >
                    {selectedParking} Parking Slot
                  </Tooltip>
                </Rectangle>
                {/* Animated vehicle marker */}
                <Marker
                  ref={markerRef}
                  draggable={!showSuccessAlert}
                  eventHandlers={{
                    dragend() {
                      const marker = markerRef.current;
                      if (marker != null) {
                        setAnimVehiclePos([
                          marker.getLatLng().lat,
                          marker.getLatLng().lng,
                        ]);
                      }
                    },
                  }}
                  position={animVehiclePos}
                  icon={createCustomMarkerIcon(
                    scannedDeviceDetails?.device_icon || "car",
                    isInsideBox && showSuccessAlert ? "#10B981" : "#3B82F6",
                    30,
                  )}
                />
              </MapContainer>
            )}

            {/* Success Overlay with Score Popup */}
            {showSuccessAlert && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-[1000] p-4">
                <div
                  className={`bg-gray-900 border ${isInsideBox ? "border-emerald-500/40 shadow-emerald-500/10" : "border-red-500/40 shadow-red-500/10"} rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl animate-in zoom-in duration-300`}
                >
                  <div
                    className={`w-20 h-20 ${isInsideBox ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-red-500/20 border-red-500 text-red-400"} border-2 rounded-full flex items-center justify-center mx-auto mb-4`}
                  >
                    <span className="text-4xl">
                      {isInsideBox ? "🎉" : "⚠️"}
                    </span>
                  </div>

                  <h2
                    className={`text-2xl font-bold ${isInsideBox ? "text-emerald-400" : "text-red-400"} mb-1`}
                  >
                    {isInsideBox ? "Correctly Parked!" : "Wrongly Parked!"}
                  </h2>
                  <div className="text-3xl font-black mb-3">
                    Score:{" "}
                    <span
                      className={
                        isInsideBox ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {parkingScore}
                    </span>
                    /100
                  </div>

                  <p className="text-gray-300 text-sm mb-6 px-2">
                    {scoreComment}
                  </p>

                  {/* Track Live Button — opens GPS Simulator map */}
                  <Button
                    onClick={() => {
                      const devCode = scannedDeviceDetails?.device_code || "";
                      setSimulatorDeviceCode(devCode);
                      setShowSimulatorMap(true);
                      setShowSuccessAlert(false);
                      setShowAnimationModal(false);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-base mb-2"
                  >
                    🚗 Track Live
                  </Button>
                  <Button
                    onClick={() => {
                      setShowSuccessAlert(false);
                      setShowAnimationModal(false);
                      setScannedDeviceDetails(null);
                      setSelectedParking("");
                      setAnimVehiclePos(null);
                      setAnimTargetPos(null);
                      setAnimBounds(null);
                      setAnimMapCenter(null);
                    }}
                    className={`w-full ${isInsideBox ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white font-bold py-3 rounded-xl text-base`}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
          {!showSuccessAlert && (
            <div className="p-4 border-t border-gray-800 flex flex-col items-center gap-4 bg-gray-900/40">
              <div className="text-center">
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
                  Nudge Position
                </p>
                <div className="flex justify-center items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-800 bg-gray-950 text-white font-bold h-9 w-12 hover:bg-gray-800"
                    onClick={() => nudgeVehicle("left")}
                  >
                    ⬅️
                  </Button>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-800 bg-gray-950 text-white font-bold h-9 w-12 hover:bg-gray-800"
                      onClick={() => nudgeVehicle("up")}
                    >
                      ⬆️
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-800 bg-gray-950 text-white font-bold h-9 w-12 hover:bg-gray-800"
                      onClick={() => nudgeVehicle("down")}
                    >
                      ⬇️
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-800 bg-gray-950 text-white font-bold h-9 w-12 hover:bg-gray-800"
                    onClick={() => nudgeVehicle("right")}
                  >
                    ➡️
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 w-full max-w-sm justify-center mt-1">
                <Button
                  onClick={() => {
                    setShowAnimationModal(false);
                    setShowParkingModal(true);
                  }}
                  variant="ghost"
                  className="bg-transparent border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl flex-1 h-11"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerifyParking}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex-1 h-11"
                >
                  Verify Parking 📍
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Full-screen GPS Simulator Map overlay ── */}
      {showSimulatorMap && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0F172A",
          }}
        >
          <SimulatorMap
            deviceCode={simulatorDeviceCode}
            deviceIcon={
              scannedDeviceDetails?.device_icon ||
              selectedDevice?.device_icon ||
              "car"
            }
            height="100vh"
            onClose={() => {
              setShowSimulatorMap(false);
              setSimulatorDeviceCode("");
              setScannedDeviceDetails(null);
              setSelectedParking("");
              setAnimVehiclePos(null);
              setAnimTargetPos(null);
              setAnimBounds(null);
              setAnimMapCenter(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

const TestDevicesPanel = ({ onSelectCode }: { onSelectCode: (code: string) => void }) => {
  const [unallocated, setUnallocated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQR, setSelectedQR] = useState<{ code: string; qr: string } | null>(null);

  const fetchUnallocated = async () => {
    setIsLoading(true);
    try {
      const response = await api.devices.list();
      const allDevices = response.data || [];
      const filtered = allDevices.filter((d: any) => d.allocated_to_customer_id === null);
      setUnallocated(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnallocated();
  }, []);

  if (unallocated.length === 0) {
    return (
      <div className="bg-amber-500/10 rounded-2xl p-6 mb-6 border border-amber-500/25">
        <h3 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <span>⚠️</span> No Test Devices Available
        </h3>
        <p className="text-sm text-gray-300">
          Please log in as <strong>Super Admin</strong> first, go to the <strong>Devices</strong> tab, and generate some devices.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 mb-6 backdrop-blur-md">
      <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
        <span>🧪</span>
        Testing & Demo Devices
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Since you are running in a simulator/web environment, use these generated hardware codes to test. Click a code to auto-fill it, or click "View QR" to scan it with your camera.
      </p>
      <div className="space-y-3">
        {unallocated.slice(0, 3).map((dev) => (
          <div key={dev.id} className="flex items-center justify-between bg-gray-950/60 p-3 rounded-xl border border-gray-800 shadow-sm">
            <div>
              <span className="text-[10px] font-semibold text-gray-500 block uppercase">Device Code</span>
              <span className="font-mono text-sm font-bold text-cyan-400">{dev.device_code}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs border-gray-800 text-gray-300 hover:text-white"
                onClick={() => {
                  setSelectedQR({ code: dev.device_code, qr: dev.qr_code });
                }}
              >
                View QR
              </Button>
              <Button
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                onClick={() => onSelectCode(dev.device_code)}
              >
                Auto Fill
              </Button>
            </div>
          </div>
        ))}
        {unallocated.length > 3 && (
          <p className="text-[10px] text-gray-500 text-center mt-2">
            + {unallocated.length - 3} more unallocated devices available in system
          </p>
        )}
      </div>

      {selectedQR && (
        <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
          <DialogContent className="max-w-xs bg-gray-950 border border-gray-900 text-white rounded-2xl p-6 flex flex-col items-center">
            <DialogHeader className="text-center w-full">
              <DialogTitle className="text-lg font-bold text-white">Scan QR Code</DialogTitle>
              <DialogDescription className="text-xs text-gray-400 mt-1">
                Point your camera at this QR code to scan it.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 p-3 border border-gray-800 rounded-xl bg-white shadow-sm flex flex-col items-center">
              <QRImage code={selectedQR.code} qrCodeData={selectedQR.qr} />
              <span className="font-mono text-xs text-gray-500 mt-2">{selectedQR.code}</span>
            </div>
            <DialogFooter className="w-full">
              <Button onClick={() => {
                onSelectCode(selectedQR.code);
                setSelectedQR(null);
              }} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                Auto Fill Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default QRScanner;
