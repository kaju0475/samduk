
import React from 'react';

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'stroke'> {
  size?: number | string;
  color?: string;
  stroke?: number;
}

export function IconCylinderCustom({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left Cylinder */}
      <path d="M7 6v13c0 1.1-.9 2-2 2s-2-.9-2-2V6c0-1.1.9-2 2-2s2 .9 2 2z" />
      <path d="M5 4h0" />
      <path d="M5 2v2" />
      <path d="M3 2h4" />

      {/* Right Cylinder */}
      <path d="M21 6v13c0 1.1-.9 2-2 2s-2-.9-2-2V6c0-1.1.9-2 2-2s2 .9 2 2z" />
      <path d="M19 4h0" />
      <path d="M19 2v2" />
      <path d="M17 2h4" />

      {/* Center Cylinder (Front) */}
      <path d="M14 8v13c0 1.1-.9 2-2 2s-2-.9-2-2V8c0-1.1.9-2 2-2s2 .9 2 2z" fill={color} stroke="none" opacity="0.2"/> 
      {/* Re-drawing center as outline to match style, or should I go full silhouette? 
         The prompt implies "reconstruct image 2", which is solid.
         But mixing solid and outline might be weird. 
         Let's stick to the outline style for consistency but capture the 3-cylinder shape.
      */}
      <path d="M14 8v13c0 1.1-.9 2-2 2s-2-.9-2-2V8c0-1.1.9-2 2-2s2 .9 2 2z" />
      <path d="M12 6h0" />
      <path d="M12 4v2" />
      <path d="M10 4h4" />
    </svg>
  );
}

export function IconChargingStandby({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {/* Cylinder Body */}
        <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" />
        
        {/* Valve */}
        <path d="M10 0.5h4" strokeWidth={stroke} />
        <path d="M12 0.5v1.5" strokeWidth={stroke} />
        
        {/* Standby Symbol (Hourglass/Pause representation or just stylized 'Standby' overlay) */}
        {/* Let's use a Pause symbol inside the cylinder to represent 'Standby' */}
        <rect x="10" y="10" width="1.5" height="4" fill={color} stroke="none"/>
        <rect x="12.5" y="10" width="1.5" height="4" fill={color} stroke="none"/>
        
        {/* Label Background for visibility if needed, but keeping it simple */}
      </svg>
    );
  }
  
  export function IconChargingInProgress({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {/* Cylinder Body */}
        <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" />
        
        {/* Valve */}
        <path d="M10 0.5h4" strokeWidth={stroke} />
        <path d="M12 0.5v1.5" strokeWidth={stroke} />
  
        {/* Charging Symbol (Lightning Bolt) */}
        <path d="M13 8l-3 4h2l-1 4" stroke={color} strokeWidth={stroke} fill="none" />
      </svg>
    );
  }
  
  export function IconChargingComplete({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {/* Cylinder Body */}
        <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" fill={color} fillOpacity="0.1" />
        <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" />
        
        {/* Valve */}
        <path d="M10 0.5h4" strokeWidth={stroke} />
        <path d="M12 0.5v1.5" strokeWidth={stroke} />
  
        {/* Complete Symbol (Checkmark circle overlay) */}
        <circle cx="16" cy="16" r="5" fill="black" stroke={color} strokeOpacity="0.1" /> 
        <circle cx="16" cy="16" r="5" stroke={color} fill="none" />
        <path d="M14 16l1.5 1.5 2.5 -2.5" stroke={color} strokeWidth={stroke} />
      </svg>
    );
  }

export function IconFactoryCustom({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
  return (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* Factory Building */}
        <path d="M4 20h5V10h-2V7H4v13z" />
        <path d="M9 20h4V12H9v8z" />
        <rect x="5" y="12" width="2" height="2" />
        <rect x="5" y="15" width="2" height="2" />
        <rect x="10" y="14" width="2" height="2" />
        
        {/* Entrance */}
        <path d="M11 20v-3h-2v3" />

        {/* Tank */}
        <path d="M18 7c-2.5 0-4.5 2-4.5 4.5v8.5h9v-8.5c0-2.5-2-4.5-4.5-4.5z" />
        {/* Tank Top Neck */}
        <path d="M17 5v2h2V5h-2z" />

        {/* Flame symbol on tank */}
        <path d="M17.5 13.5c0 1-0.8 1.5-1.5 1.5s-1.5-0.5-1.5-1.5c0-1 1.5-2.5 1.5-2.5s1.5 1.5 1.5 2.5z" />

        {/* Connecting Pipe */}
        <path d="M18 5V3h-5" />
    </svg>
  );
}

export function IconInspectionCustom({ size = 24, color = 'currentColor', stroke = 1.5, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
        {/* Cylinder Body */}
        <path d="M8 5v14c0 1.66 3.13 3 7 3" />
        <path d="M8 5c0-1.66 3.13-3 7-3s7 1.34 7 3v7" />
        
        {/* Valve */}
        <path d="M13 2H17" />
        <path d="M15 0V2" />
        <path d="M17 2v2" />

        {/* Magnifying Glass Overlay */}
        <circle cx="16" cy="16" r="4" />
        <path d="M19 19l3 3" />
    </svg>
  );
}
