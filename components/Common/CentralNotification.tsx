import { Portal, Transition, Paper, Text, Center, ThemeIcon } from '@mantine/core';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface CentralNotificationProps {
    opened: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    subMessage?: string;
    onClose: () => void;
    duration?: number;
}

export function CentralNotification({ opened, type, message, subMessage, onClose, duration = 3000 }: CentralNotificationProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (opened && duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [opened, duration, onClose]);

    if (!mounted) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <IconCheck size={40} />;
            case 'error': return <IconX size={40} />;
            case 'warning': return <IconAlertTriangle size={40} />;
            case 'info': return <IconInfoCircle size={40} />;
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return 'teal';
            case 'error': return 'red';
            case 'warning': return 'orange';
            case 'info': return 'blue';
        }
    };

    const getBackgroundColor = () => {
        switch (type) {
            // [UI Polish] Subtle tints with 95% opacity base + slight color
            // Dark Base (#1A1B1E) mixed with colors
            case 'success': return 'rgba(20, 40, 30, 0.95)'; // Greenish Dark
            case 'error': return 'rgba(40, 20, 20, 0.95)';   // Reddish Dark
            case 'warning': return 'rgba(40, 30, 20, 0.95)'; // Orangish Dark
            case 'info': return 'rgba(20, 30, 40, 0.95)';    // Bluish Dark
        }
    };

    const getBorderColor = () => {
        switch (type) {
             case 'success': return 'rgba(32, 201, 151, 0.3)';
             case 'error': return 'rgba(250, 82, 82, 0.3)';
             case 'warning': return 'rgba(253, 126, 20, 0.3)';
             case 'info': return 'rgba(34, 139, 230, 0.3)';
        }
    };

    return (
        <Portal>
            <Transition mounted={opened} transition="pop" duration={200} timingFunction="ease">
                {(styles) => (
                    <div
                        style={{
                            ...styles,
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 2147483647, // Maximum safe integer for z-index
                            pointerEvents: 'none', // Allow clicking through the full-screen container
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {/* Overlay to dim background (optional, removed for "toast" feel, added back if modal-like behavior is desired. Keeping it transparent for now but blocking clicks on the notification itself) */}
                        <div style={{ pointerEvents: 'auto' }}> 
                            <Paper
                                shadow="xl"
                                radius="lg"
                                p="xl"
                                withBorder
                                style={{
                                    // [UI Polish] Dynamic Background & Border for better visibility
                                    backgroundColor: getBackgroundColor(),
                                    borderColor: getBorderColor(),
                                    minWidth: 300,
                                    maxWidth: '90vw',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: `0 8px 30px rgba(0,0,0,0.5)`, // Enhanced Shadow
                                }}
                            >
                                <Center>
                                    <ThemeIcon
                                        size={80}
                                        radius="100%"
                                        color={getColor()}
                                        variant="light"
                                        style={{ marginBottom: 20 }}
                                    >
                                        {getIcon()}
                                    </ThemeIcon>
                                </Center>
                                <Text ta="center" size="xl" fw={700} c="white" mb={subMessage ? 8 : 0}>
                                    {message}
                                </Text>
                                {subMessage && (
                                    <Text ta="center" size="md" c="dimmed">
                                        {subMessage}
                                    </Text>
                                )}
                            </Paper>
                        </div>
                    </div>
                )}
            </Transition>
        </Portal>
    );
}
