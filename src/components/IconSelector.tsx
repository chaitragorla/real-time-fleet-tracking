import React from 'react';
import { Car, Truck, Bus, Bike, Plane, Ship, Train, Ambulance, Flame } from 'lucide-react';

interface IconSelectorProps {
  selectedIcon: string;
  onIconSelect: (icon: string) => void;
  className?: string;
}

const iconOptions = [
  { name: 'car', icon: Car, label: 'Car' },
  { name: 'truck', icon: Truck, label: 'Truck' },
  { name: 'bus', icon: Bus, label: 'Bus' },
  { name: 'bike', icon: Bike, label: 'Bike' },
  { name: 'motorcycle', icon: Bike, label: 'Motorcycle' },
  { name: 'plane', icon: Plane, label: 'Plane' },
  { name: 'ship', icon: Ship, label: 'Ship' },
  { name: 'train', icon: Train, label: 'Train' },
  { name: 'ambulance', icon: Ambulance, label: 'Ambulance' },
  { name: 'firetruck', icon: Flame, label: 'Fire Truck' }
];

export const IconSelector: React.FC<IconSelectorProps> = ({ selectedIcon, onIconSelect, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Choose Device Icon
      </label>
      <div className="grid grid-cols-5 gap-2">
        {iconOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <button
              key={option.name}
              type="button"
              onClick={() => onIconSelect(option.name)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                selectedIcon === option.name
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
              title={option.label}
            >
              <IconComponent size={24} className="mx-auto" />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Selected: {iconOptions.find(opt => opt.name === selectedIcon)?.label || 'Car'}
      </p>
    </div>
  );
};

export { iconOptions };