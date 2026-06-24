import React from 'react';
import { Car, Truck, Bus, Bike, Plane, Ship, Train, Ambulance, Flame } from 'lucide-react';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';

const iconComponents = {
  car: Car,
  truck: Truck,
  bus: Bus,
  bike: Bike,
  motorcycle: Bike,
  plane: Plane,
  ship: Ship,
  train: Train,
  ambulance: Ambulance,
  firetruck: Flame
};

export const getIconComponent = (iconName: string) => {
  return iconComponents[iconName as keyof typeof iconComponents] || Car;
};

export const createCustomMarkerIcon = (iconName: string, color: string = '#3B82F6', size: number = 24, isActive?: boolean) => {
  // Use real car image for 'car' type
  if (!iconName || iconName === 'car') {
    const imgSize = size * 2.5; // Make the car significantly bigger
    const html = `
      <img
        src="/car-marker.png"
        alt="car"
        style="width: ${imgSize}px; height: ${imgSize}px; object-fit: contain; filter: drop-shadow(0px 6px 10px rgba(0,0,0,0.5)); display: block; background: transparent;"
      />
    `;
    return L.divIcon({
      html,
      className: 'custom-marker-icon-bare', // Use a different class to avoid default background/borders
      iconSize: [imgSize, imgSize],
      iconAnchor: [imgSize / 2, imgSize / 2],
      popupAnchor: [0, -(imgSize / 2)]
    });
  }

  // Fallback: Lucide SVG icon for other vehicle types
  const IconComponent = getIconComponent(iconName);
  const iconSvg = renderToString(
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '50%', 
      padding: '8px', 
      border: `3px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <IconComponent size={size} color={color} />
    </div>
  );
  
  return L.divIcon({
    html: iconSvg,
    className: 'custom-marker-icon',
    iconSize: [size + 16, size + 16],
    iconAnchor: [size/2 + 8, size/2 + 8],
    popupAnchor: [0, -(size/2 + 8)]
  });
};

export const createStartIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        background-color: white;
        border-radius: 50%;
        padding: 8px;
        border: 3px solid #10B981;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background-color: #10B981;
          border-radius: 50%;
        "></div>
      </div>
    `,
    className: 'start-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export const getGeofenceOffsets = (vehicleIcon: string) => {
  const icon = (vehicleIcon || 'car').toLowerCase();
  if (icon === 'bike' || icon === 'motorcycle') {
    // Small vehicle geofence bounds (50% smaller)
    return {
      home: [
        [0.0009, 0.0009],
        [0.0011, 0.0011]
      ] as [number, number][],
      college: [
        [-0.0011, 0.0009],
        [-0.0009, 0.0011]
      ] as [number, number][],
      office: [
        [-0.0011, -0.0011],
        [-0.0009, -0.0009]
      ] as [number, number][],
      centerOffset: {
        HOME: [0.001, 0.001] as [number, number],
        COLLEGE: [-0.001, 0.001] as [number, number],
        OFFICE: [-0.001, -0.001] as [number, number]
      }
    };
  } else if (icon === 'truck' || icon === 'bus' || icon === 'train' || icon === 'ship') {
    // Large vehicle geofence bounds (50% smaller)
    return {
      home: [
        [0.00055, 0.00055],
        [0.00145, 0.00145]
      ] as [number, number][],
      college: [
        [-0.00145, 0.00055],
        [-0.00055, 0.00145]
      ] as [number, number][],
      office: [
        [-0.00145, -0.00145],
        [-0.00055, -0.00055]
      ] as [number, number][],
      centerOffset: {
        HOME: [0.001, 0.001] as [number, number],
        COLLEGE: [-0.001, 0.001] as [number, number],
        OFFICE: [-0.001, -0.001] as [number, number]
      }
    };
  } else {
    // Default (car, ambulance, firetruck, plane, etc.) (50% smaller)
    return {
      home: [
        [0.00075, 0.00075],
        [0.00125, 0.00125]
      ] as [number, number][],
      college: [
        [-0.00125, 0.00075],
        [-0.00075, 0.00125]
      ] as [number, number][],
      office: [
        [-0.00125, -0.00125],
        [-0.00075, -0.00075]
      ] as [number, number][],
      centerOffset: {
        HOME: [0.001, 0.001] as [number, number],
        COLLEGE: [-0.001, 0.001] as [number, number],
        OFFICE: [-0.001, -0.001] as [number, number]
      }
    };
  }
};