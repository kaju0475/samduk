'use client';

import { Badge, BadgeProps } from '@mantine/core';
import { getGasColor } from '@/app/utils/gas';

interface GasBadgeProps extends BadgeProps {
    gasType: string | undefined | null;
    color?: string; // Add explicit color prop override
    isRack?: boolean;
    rackInfo?: string; // e.g. 'RACK-0001'
}

export function GasBadge({ gasType, color: propColor, isRack, rackInfo, ...props }: GasBadgeProps) {
    const color = propColor || getGasColor(gasType);
    return (
        <Badge 
            variant="filled" 
            color={color} 
            size="sm"
            {...props}
            style={{ 
                textTransform: 'none', 
                minWidth: 'auto',
                ...props.style 
            }}
        >
            {gasType || '미지정'}
            {rackInfo ? ` (${rackInfo})` : (isRack ? ' (렉)' : '')}
        </Badge>
    );
}
