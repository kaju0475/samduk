import { Box, Portal } from '@mantine/core';

interface EdgeLightingProps {
    color?: string;
    active: boolean;
}

export const EdgeLighting = ({ color = '#339AF0', active }: EdgeLightingProps) => {
    if (!active) return null;

    // Convert hex to rgb for opacity handling if needed, but for now simple hex is fine 
    // or we assume the color prop is hex. 
    // Effect: A pulsing inset shadow.
    
    // Generate a unique ID for the keyframe if generic, but global 'edge-pulse' is fine given scope.
    
    const pulseKeyframes = `
        @keyframes edge-pulse-custom {
            0% { box-shadow: inset 0 0 0 0px ${color}00; }
            50% { box-shadow: inset 0 0 25px 6px ${color}80; }
            100% { box-shadow: inset 0 0 0 0px ${color}00; }
        }
    `;

    return (
        <Portal>
            <style>{pulseKeyframes}</style>
            <Box
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    animation: `edge-pulse-custom 2s infinite ease-in-out`,
                    borderRadius: '0px'
                }}
            />
        </Portal>
    );
};
