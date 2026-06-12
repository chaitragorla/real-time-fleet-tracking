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

export const createCustomMarkerIcon = (iconName: string, color: string = '#3B82F6', size: number = 24) => {
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
    popupAnchor: [0, -16]
  });
};