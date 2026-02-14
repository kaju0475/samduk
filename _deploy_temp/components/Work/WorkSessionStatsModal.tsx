'use client';

import { Modal, Stack, Group, Text, Box, Button, ThemeIcon } from '@mantine/core';
import { GasBadge } from '@/components/Common/GasBadge';
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';

interface SectionData {
    key: string;
    label: string;
    color: 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'cyan';
    count: number;
    items: Record<string, number>; // Gas -> Count
}

interface WorkSessionStatsModalProps {
    opened: boolean;
    onClose: () => void;
    title?: string;
    subTitle?: string;
    sections: SectionData[];
    totalCount: number;
    headerContent?: React.ReactNode; // Optional extra content (e.g. Customer Name)
}

export function WorkSessionStatsModal({ 
    opened, 
    onClose, 
    title = '작업 현황', 
    subTitle,
    sections,
    totalCount,
    headerContent
}: WorkSessionStatsModalProps) {
    // [VISUAL_FEEDBACK] Subscribe to store
    const { isActive, type, message, subMessage } = useVisualFeedbackStore();

    // Determine Border Color based on Feedback Type
    const getBorderColor = () => {
        if (!isActive) return 'transparent';
        switch (type) {
            case 'success': return '#40C057'; // Green
            case 'warning': return '#FD7E14'; // Orange
            case 'error': return '#FA5252';   // Red
            default: return 'transparent';
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={onClose}
            closeOnEscape={false} 
            title={
                <Group gap="xs">
                    <Text fw={700} size="lg">{title}</Text>
                    <Text fw={700} size="lg" c="dimmed">
                        {subTitle || `(총 ${totalCount}개)`}
                    </Text>
                </Group>
            }
            centered
            size="md"
            zIndex={200} // Standard Modal Level
            styles={{
                header: { backgroundColor: '#1A1B1E', color: 'white' },
                content: { 
                    backgroundColor: '#1A1B1E', 
                    color: 'white',
                    // [VISUAL_FEEDBACK] Dynamic Border & Shadow
                    border: `3px solid ${getBorderColor()}`,
                    boxShadow: isActive ? `0 0 20px ${getBorderColor()}` : 'none',
                    transition: 'border 0.2s ease, box-shadow 0.2s ease'
                },
                body: { backgroundColor: '#1A1B1E' }
            }}
        >
            <Stack gap="lg" pos="relative">
                
                {/* [VISUAL_FEEDBACK] Notification Banner (Premium Glass) */}
                {isActive && message && (
                    <Box 
                        style={{
                            background: type === 'error' 
                                ? 'linear-gradient(135deg, rgba(250, 82, 82, 0.80) 0%, rgba(200, 40, 40, 0.80) 100%)' 
                                : type === 'warning' 
                                ? 'linear-gradient(135deg, rgba(253, 126, 20, 0.80) 0%, rgba(230, 100, 0, 0.80) 100%)' 
                                : 'linear-gradient(135deg, rgba(55, 178, 77, 0.80) 0%, rgba(40, 140, 60, 0.80) 100%)',
                            border: `1px solid ${getBorderColor()}`,
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                            marginBottom: '20px',
                            animation: 'fadeIn 0.1s ease-out' // Super fast
                        }}
                    >
                        <Group gap="md" wrap="nowrap" align="center" w="100%">
                             <ThemeIcon 
                                color="white" 
                                variant="transparent" 
                                size="xl" 
                             >
                                {type === 'success' && <IconCheck size={32} stroke={2.5} />}
                                {type === 'warning' && <IconAlertTriangle size={32} stroke={2.5} />}
                                {type === 'error' && <IconX size={32} stroke={2.5} />}
                             </ThemeIcon>
                            <Box style={{ flex: 1 }}>
                                <Text c="white" fw={800} size="lg" style={{ lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                    {message}
                                </Text>
                                {subMessage && (
                                    <Text c="rgba(255,255,255,0.9)" size="sm" mt={4} fw={600}>
                                        {subMessage}
                                    </Text>
                                )}
                            </Box>
                        </Group>
                    </Box>
                )}

                {headerContent}

                {sections.map((section) => (
                    section.count > 0 && (
                        <Box key={section.key} mt={isActive && message ? 'xl' : 0}>
                            <Group justify="space-between" mb="sm">
                                <Text fw={700} size="xl" c={section.color}>{section.label}</Text>
                                <Text fw={700} size="xl" c={section.color}>{section.count}개</Text>
                            </Group>
                            <Stack gap="xs">
                                {Object.entries(section.items).map(([key, count]) => {
                                    // [Update] Handle Composite Key "GasType:ContainerType"
                                    const [gasType, containerType] = key.split(':');
                                    const isRack = containerType === 'RACK';
                                    
                                    return (
                                        <Group key={key} justify="space-between" p="sm" style={{ 
                                            backgroundColor: `rgba(${getColorType(section.color)}, 0.1)`, 
                                            borderRadius: '8px', 
                                            border: `1px solid rgba(${getColorType(section.color)}, 0.3)` 
                                        }}>
                                            <GasBadge gasType={gasType} size="lg" isRack={isRack} />
                                            <Text size="2rem" fw={900} c={section.color}>{count}개</Text>
                                        </Group>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )
                ))}

                <Button 
                    fullWidth 
                    size="lg" 
                    color="gray" 
                    variant="filled"
                    onClick={onClose}
                    mt="md"
                    style={{ fontSize: '1.2rem', fontWeight: 700 }}
                >
                    확인
                </Button>
            </Stack>
        </Modal>
    );
}

// Helper to map color names to RGB values for background opacity
function getColorType(color: string): string {
    switch (color) {
        case 'blue': return '51, 154, 240';
        case 'green': return '64, 192, 87';
        case 'red': return '250, 82, 82';
        case 'orange': return '253, 126, 20';
        case 'cyan': return '21, 170, 191';
        case 'yellow': return '250, 204, 21';
        default: return '255, 255, 255';
    }
}
