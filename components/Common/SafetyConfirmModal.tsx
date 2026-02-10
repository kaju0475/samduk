'use client';

import { Modal, Text, Button, Group, Stack, ThemeIcon, Paper, List } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconCheck, IconInfoCircle } from '@tabler/icons-react';

export type SafetyLevel = 'info' | 'warning' | 'error' | 'success';

interface SafetyConfirmModalProps {
    opened: boolean;
    onClose: () => void;
    onConfirm: () => void;
    level: SafetyLevel;
    title: string;
    message: string;
    subMessages?: string[];
    confirmLabel?: string;
    cancelLabel?: string;
    isBlocking?: boolean; // Error level should be blocking (no confirm)
}

export function SafetyConfirmModal({
    opened,
    onClose,
    onConfirm,
    level,
    title,
    message,
    subMessages = [],
    confirmLabel = '계속 진행',
    cancelLabel = '취소',
    isBlocking = false
}: SafetyConfirmModalProps) {
    
    const colors = {
        info: 'blue',
        warning: 'yellow',
        error: 'red',
        success: 'teal'
    };

    const icons = {
        info: <IconInfoCircle size={32} />,
        warning: <IconAlertTriangle size={32} />,
        error: <IconAlertCircle size={32} />,
        success: <IconCheck size={32} />
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            withCloseButton={!isBlocking}
            centered
            radius="lg"
            padding="xl"
            overlayProps={{
                backgroundOpacity: 0.6,
                blur: 3,
            }}
            styles={{
                content: { backgroundColor: '#1A1B1E', border: `1px solid rgba(255,255,255,0.1)` },
                header: { backgroundColor: '#1A1B1E' },
                title: { color: 'white', fontWeight: 700 }
            }}
        >
            <Stack gap="lg">
                <Group align="center" gap="md">
                    <ThemeIcon size={56} radius="xl" color={colors[level]} variant="light">
                        {icons[level]}
                    </ThemeIcon>
                    <Stack gap={0} style={{ flex: 1 }}>
                        <Text size="xl" fw={700} c="white">
                            {title}
                        </Text>
                        <Text size="sm" c="dimmed">
                            {level === 'error' ? '오류 (차단됨)' : 
                             level === 'warning' ? '경고 (주의)' : 
                             level === 'success' ? '작업 완료' : '알림'}
                        </Text>
                    </Stack>
                </Group>

                <Paper p="md" radius="md" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Text size="md" fw={500} c="white" mb={subMessages.length > 0 ? 'xs' : 0}>
                        {message}
                    </Text>
                    {subMessages.length > 0 && (
                        <List 
                            size="sm" 
                            c="dimmed" 
                            spacing="xs"
                            icon={
                                <ThemeIcon color={colors[level]} size={16} radius="xl">
                                    <IconCheck size={10} />
                                </ThemeIcon>
                            }
                        >
                            {subMessages.map((msg, idx) => (
                                <List.Item key={idx}>{msg}</List.Item>
                            ))}
                        </List>
                    )}
                </Paper>

                <Group justify="flex-end" gap="sm">
                    {!isBlocking && (
                        <Button variant="subtle" color="gray" onClick={onClose}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button 
                        color={colors[level]} 
                        onClick={() => {
                            if (!isBlocking) {
                                onConfirm();
                                onClose();
                            } else {
                                onClose();
                            }
                        }}
                    >
                        {isBlocking ? '확인' : confirmLabel}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
