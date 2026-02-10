'use client';

import { useEffect, useState } from 'react';
import { Modal, Text, Button, Stack, Group, ThemeIcon } from '@mantine/core';
import { IconCamera, IconCheck } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';

export function CameraPermissionRequest() {
    const [opened, setOpened] = useState(false);
    const [step, setStep] = useState<'request' | 'success'>('request');
    const isMobile = useMediaQuery('(max-width: 48em)');

    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return;

        const checkPermission = async () => {
            // 1. Check if already requested in LocalStorage
            const hasRequested = localStorage.getItem('camera_permission_requested');
            
            // 2. Check actual Browser Capability/Permission
            let isAlreadyGranted = false;
            try {
                // Method A: Permissions API
                if (navigator.permissions && navigator.permissions.query) {
                    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
                    if (status.state === 'granted') {
                        isAlreadyGranted = true;
                    }
                }
                
                // Method B: Enumerate Devices (If labels exist, permission is granted)
                if (!isAlreadyGranted && navigator.mediaDevices?.enumerateDevices) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoInput = devices.find(d => d.kind === 'videoinput');
                    if (videoInput && videoInput.label.length > 0) {
                        isAlreadyGranted = true;
                    }
                }
            } catch (e) {
                console.warn('Permission check failed', e);
            }

            // Decision: Show modal ONLY IF:
            // - Mobile
            // - NOT already requested (LocalStorage)
            // - NOT already granted (Browser)
            if (isMobile && !hasRequested && !isAlreadyGranted) {
                setOpened(true);
            } else if (isAlreadyGranted) {
                // If granted but storage missing, sync it silently
                if (!hasRequested) {
                    localStorage.setItem('camera_permission_requested', 'true');
                }
            }
        };

        checkPermission();
    }, [isMobile]);

    const handleRequest = async () => {
        try {
            // Request minimal video stream to trigger the browser prompt
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // If we get here, user allowed it.
            // Stop the stream immediately to release camera
            stream.getTracks().forEach(track => track.stop());

            // Mark as success
            setStep('success');
            localStorage.setItem('camera_permission_requested', 'true');

            // Close after short delay
            setTimeout(() => {
                setOpened(false);
            }, 1500);

        } catch (error) {
            console.warn('Camera permission denied or error:', error);
            // Even if failed/denied, mark as requested so we don't loop
            localStorage.setItem('camera_permission_requested', 'true');
            setOpened(false);
        }
    };

    const handleLater = () => {
        // User deferred. We can ask again next session (sessionStorage) or never (localStorage).
        // Let's use localStorage to not annoy them, assuming they know what they are doing.
        // OR better: sessionStorage, so it asks again next visit? 
        // User requested: "Ask like an app first time". Usually means once per install/lifetime.
        localStorage.setItem('camera_permission_requested', 'true');
        setOpened(false);
    };

    return (
        <Modal 
            opened={opened} 
            onClose={() => {}} 
            withCloseButton={false}
            centered
            size="sm"
            closeOnClickOutside={false}
            closeOnEscape={false}
            styles={{
                content: { backgroundColor: '#1A1B1E', border: '1px solid rgba(255,255,255,0.1)' },
                body: { padding: '24px' }
            }}
            zIndex={9999} // Highest priority
        >
            {step === 'request' ? (
                <Stack align="center" gap="lg">
                    <ThemeIcon size={60} radius="xl" color="blue" variant="light">
                        <IconCamera size={32} />
                    </ThemeIcon>
                    
                    <Stack gap="xs" align="center">
                        <Text fw={700} size="lg" c="white">카메라 권한 요청</Text>
                        <Text c="dimmed" size="sm" ta="center" style={{ wordBreak: 'keep-all' }}>
                            QR 코드 스캔을 위해 카메라 접근 권한이 필요합니다.<br/>
                            아래 <b>[허용하기]</b> 버튼을 누른 후,<br/>
                            브라우저 팝업에서 <b>[허용]</b>을 선택해주세요.
                        </Text>
                    </Stack>

                    <Group w="100%">
                        <Button variant="default" onClick={handleLater} fullWidth flex={1} bg="transparent" c="dimmed" style={{ border: '1px solid #373A40' }}>
                            나중에
                        </Button>
                        <Button onClick={handleRequest} fullWidth flex={2} color="blue">
                            허용하기
                        </Button>
                    </Group>
                </Stack>
            ) : (
                <Stack align="center" gap="md" py="lg">
                    <ThemeIcon size={60} radius="xl" color="green" variant="light">
                        <IconCheck size={32} />
                    </ThemeIcon>
                    <Text fw={700} size="lg" c="white">완료되었습니다</Text>
                </Stack>
            )}
        </Modal>
    );
}
