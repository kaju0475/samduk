
'use client';

import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';

export default function VisualFeedbackOverlay() {
    const { isActive, type } = useVisualFeedbackStore();

    const colors = {
        success: { border: '#40c057', shadow: 'rgba(64, 192, 87, 0.6)' }, // Green
        warning: { border: '#FFC107', shadow: 'rgba(255, 193, 7, 0.6)' }, // Amber
        error: { border: '#fa5252', shadow: 'rgba(250, 82, 82, 0.6)' },   // Red
    };

    const config = colors[type];
    const duration = type === 'success' ? '0.5s' : type === 'warning' ? '1s' : '1.5s';

    // Optimization: When strictly inactive, hide it completely to avoid any painting overhead
    // However, we need it present for the fade-out transition.
    // Since 'isActive' goes false to trigger fade out, we rely on opacity.
    
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none', // Critical: Ensures clicks pass through
                zIndex: 9999,
                border: isActive ? `12px solid ${config.border}` : '0px solid transparent',
                boxShadow: isActive ? `inset 0 0 60px ${config.shadow}` : 'none',
                transition: `all ${duration} ease-out`,
                opacity: isActive ? 1 : 0,
            }}
        />
    );
}
