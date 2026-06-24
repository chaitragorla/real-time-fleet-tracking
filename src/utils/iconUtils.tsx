import React from 'react';
import { Car, Truck, Bus, Bike, Plane, Ship, Train, Ambulance, Flame } from 'lucide-react';
import L from 'leaflet';

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

  // Fallback: Build a raw SVG string for standard Lucide icons
  // rather than using renderToString, which crashes in Vite production builds.
  let svgPath = '';
  switch (iconName) {
    case 'truck': svgPath = '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'; break;
    case 'bus': svgPath = '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>'; break;
    case 'bike':
    case 'motorcycle': svgPath = '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'; break;
    default: svgPath = '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'; break; // generic icon
  }

  const iconSvg = `
    <div style="background-color: white; border-radius: 50%; padding: 8px; border: 3px solid ${color}; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${svgPath}
      </svg>
    </div>
  `;
  
  return L.divIcon({
    html: iconSvg,
    className: 'custom-marker-icon',
    iconSize: [size + 16, size + 16],
    iconAnchor: [(size + 16) / 2, (size + 16) / 2],
    popupAnchor: [0, -((size + 16) / 2)]
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