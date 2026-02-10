import { Modal, Text, Button, Stack, Loader, Center, Alert, Box, Transition, Group, ScrollArea, Badge, Slider, ActionIcon } from '@mantine/core';
import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState, useId } from 'react';
import { IconAlertTriangle, IconCheck, IconX, IconBolt, IconBoltOff, IconZoomIn, IconZoomOut } from '@tabler/icons-react'; // [Added] Icons
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';
import { GasBadge } from '@/components/Common/GasBadge';

// [Shared Type Definition - Should ideally be in types but defining here for now]
interface SectionData {
    key: string;
    label: string;
    color: string;
    count: number;
    items: Record<string, number>;
}

interface QRScannerModalProps {
    opened: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
    mode?: 'single' | 'continuous';
    titlePrefix?: string; // [NEW] Display Prefix
    // [Stats Integration]
    statsSections?: SectionData[];
    totalCount?: number;
    sessionName?: string;
    paused?: boolean; // [NEW] Control scanning state
}

export function QRScannerModal({ 
    opened, 
    onClose, 
    onScan, 
    mode = 'single',
    titlePrefix,
    statsSections = [],
    totalCount = 0,
    sessionName,
    paused = false
}: QRScannerModalProps) {
    const uniqueId = useId();
    const mountNodeId = `reader-${uniqueId.replace(/:/g, '-')}`;
    
    const [status, setStatus] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'ERROR'>('IDLE');
    const [errorMessage, setErrorMessage] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const lastScanned = useRef<string>('');
    const lastScanTime = useRef<number>(0); 
    const lastFeedbackTime = useRef<number>(0); 
    
    // [NEW] Camera Capabilities State
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 }); // Default no zoom

    // [NEW] Track paused state and RESET memory on Resume
    const pausedRef = useRef(paused);
    useEffect(() => { 
        pausedRef.current = paused;
        // [UX FIX] If resuming (paused -> false), clear memory to allow immediate re-scan of the same code
        // This ensures the user sees the "Server Error" again, not "Duplicate Scan"
        if (!paused) {
            lastScanned.current = '';
        }
    }, [paused]);

    // [VISUAL_FEEDBACK] & [HAPTIC_FEEDBACK]
    const { isActive, type, message, subMessage } = useVisualFeedbackStore();

    // Haptic Effect
    useEffect(() => {
        if (isActive && typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                if (type === 'success') {
                     // Light Vibration (Normal)
                     console.log('[Haptic] Success');
                     navigator.vibrate(100); 
                } else if (type === 'warning') {
                     // Medium Vibration (Warning)
                     console.log('[Haptic] Warning');
                     navigator.vibrate(300);
                } else if (type === 'error') {
                     // Strong Double Vibration (Error)
                     console.log('[Haptic] Error');
                     navigator.vibrate([200, 50, 200]);
                }
            } catch (e) {
                console.warn('[Haptic] Error:', e);
            }
        }
    }, [isActive, type]);

    // Apply Camera Constraints (Zoom/Torch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyConstraints = async (overrides: any) => {
        if (!scannerRef.current) return;
        try {
            // Apply to running video track
             await scannerRef.current.applyVideoConstraints(overrides);
        } catch (e) {
            console.warn('[Camera] Failed to apply constraints:', e);
        }
    };

    const handleTorchToggle = () => {
        const newState = !torchOn;
        setTorchOn(newState);
        applyConstraints({ advanced: [{ torch: newState }] });
    };

    const handleZoomChange = (value: number) => {
        setZoom(value);
        applyConstraints({ advanced: [{ zoom: value }] });
    };

    useEffect(() => {
        if (!opened) return;

        // Reset
        lastScanned.current = '';
        lastFeedbackTime.current = 0; // Reset Feedback Timer
        
        // [FIX] Fix synchronous setState warning by deferring updates
        const timer = setTimeout(() => {
            setTorchOn(false);
            setZoom(1);
        }, 0);
        
        let isMounted = true;
        let scanner: Html5Qrcode | null = null;

        const initScanner = async () => {
             // ... (Existing Checks) ...
             if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
                return;
             }

             if (isMounted) setStatus('STARTING');
             await new Promise(r => setTimeout(r, 300));
             if (!isMounted) return;

             try {
                scanner = new Html5Qrcode(mountNodeId);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        if (!isMounted) return;

                        // [CRITICAL] Pause Scanning if Feedback is Active OR Explicitly Paused
                        if (useVisualFeedbackStore.getState().isActive) return; 
                        if (pausedRef.current) return; 

                        const now = Date.now();
                        const isSameCode = decodedText === lastScanned.current;
                        
                        // [SMART COOLDOWN & DUPLICATE FEEDBACK]
                        // 1. Same code logic
                        if (isSameCode) {
                            // If within 5 seconds, treat as duplicate
                            if (now - lastScanTime.current < 5000) {
                                // [NEW] User Request: "중복스캔 이라고 글자만" (Visual Only, No Vibrate - handled by 'warning')
                                // Wait, simple Duplicate is just a warning, but we want to avoid spamming Haptics?
                                // Stores handle throttled feedback.
                                if (now - lastFeedbackTime.current > 1500) {
                                     useVisualFeedbackStore.getState().trigger('warning', '중복 스캔', '이미 인식된 QR코드입니다.');
                                     lastFeedbackTime.current = now;
                                }
                                return; // Stop processing
                            }
                        }
                        
                        // 2. Different code: 1초 쿨다운
                        if (!isSameCode && now - lastScanTime.current < 1000) return;

                        lastScanned.current = decodedText;
                        lastScanTime.current = now;
                        
                        onScan(decodedText);
                    },
                    () => {}
                );

                // [NEW] Get Capabilities (Torch/Zoom)
                try {
                     const track = scanner.getRunningTrackCameraCapabilities(); // This returns MediaTrackCapabilities
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     const caps = track as any; // Cast for custom props like torch/zoom
                     
                     if (isMounted) {
                         // Torch
                         if ('torch' in caps || 'fillLightMode' in caps) {
                             setHasTorch(true);
                         }
                         // Zoom
                         if ('zoom' in caps) {
                             const { min, max } = caps.zoom as { min: number, max: number };
                             setZoomRange({ min, max });
                             setZoom(min); // Init at min
                         }
                     }
                } catch (e) {
                    console.warn('[Scanner] Failed to get capabilities:', e);
                }

                if (isMounted) setStatus('SCANNING');
            } catch (err: unknown) {
                // [ERROR_HANDLING] Ignore benign 'interrupted' errors
                const errorObj = err as { name?: string; message?: string };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const isInterrupted = errorObj?.name === 'AbortError' || (errorObj as any) === 'Html5QrcodeScannerError: Scan aborted' || errorObj?.message?.includes('interrupted') || errorObj?.message?.includes('media was removed');
                
                if (isInterrupted) {
                    console.warn("Scanner start interrupted (benign):", err);
                    return; // Ignore
                }

                console.warn("Scanner Error (Downgraded):", err); 

                if (isMounted) {
                    setStatus('ERROR');
                    if (errorObj?.name === 'NotAllowedError' || errorObj?.message?.includes('permission')) {
                        setErrorMessage('카메라 권한이 거부되었습니다.');
                    } else if (errorObj?.name === 'NotFoundError') {
                        setErrorMessage('카메라를 찾을 수 없습니다.');
                    } else {
                        setErrorMessage('카메라 실행 중 오류가 발생했습니다.');
                    }
                }
            }
        };

        initScanner();

        return () => {
            clearTimeout(timer); // [FIX] Cleanup timer
            isMounted = false;
            if (scanner) {
                const scannerInstance = scanner; 
                const performCleanup = async () => {
                    try {
                        if (scannerInstance.isScanning) {
                            await scannerInstance.stop();
                        }
                        scannerInstance.clear();
                    } catch (e) {
                        console.warn('[Scanner] Cleanup warning:', e);
                        try { scannerInstance.clear(); } catch { /* ignore */ }
                    }
                };
                performCleanup();
            }
            scannerRef.current = null;
        };
    }, [opened, mountNodeId, onScan]); 


    const handleBackClose = useModalBackTrap(opened, onClose, 'qr-scanner');

    // [VISUAL_FEEDBACK] Color Helper
    const getFeedbackColor = () => {
        switch (type) {
            case 'success': return '#40C057'; // Green
            case 'warning': return '#FCC419'; // Yellow
            case 'error': return '#FA5252';   // Red
            default: return 'transparent';
        }
    };

    // Helper for Gas Color BG
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

    return (
        <Modal 
            opened={opened} 
            onClose={handleBackClose} 
            title={
                <Group justify="space-between" w="100%">
                    <Group gap="xs">
                        {titlePrefix && <Badge variant="light" color="blue" size="lg">{titlePrefix}</Badge>}
                        <Text fw={700} size="lg">
                            {mode === 'continuous' ? "연속 스캔" : "QR 스캔"}
                        </Text>
                    </Group>
                     {sessionName && (
                        <Badge variant="filled" color="gray" size="lg">
                            {sessionName}
                        </Badge>
                     )}
                </Group>
            }
            fullScreen // [LAYOUT] Full Screen for Mobile
            styles={{
                content: { backgroundColor: '#1A1B1E', color: 'white', display: 'flex', flexDirection: 'column' },
                header: { backgroundColor: '#1A1B1E', color: 'white', borderBottom: '1px solid #333', padding: '8px 16px', minHeight: 'auto' },
                body: { 
                    padding: 0, 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden' 
                } 
            }}
            closeOnEscape={false}
        >
            {/* 1. Top Section: Camera - 50% Height */}
            <Box 
                pos="relative" 
                style={{ 
                    width: '100%', 
                    flex: '0 0 40%', // [LAYOUT] Fixed 40% height for Camera
                    backgroundColor: 'black', 
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #333'
                }}
            >
                {status === 'ERROR' && (
                    <Center w="100%" h="100%">
                         <Alert icon={<IconAlertTriangle size={16} />} title="카메라 오류" color="red">
                            {errorMessage}
                         </Alert>
                    </Center>
                )}
                
                {status === 'STARTING' && (
                    <Center style={{ position: 'absolute', zIndex: 10 }}>
                        <Stack gap="xs" align="center">
                            <Loader color="blue" />
                            <Text size="xs" c="white">카메라 시작 중...</Text>
                        </Stack>
                    </Center>
                )}

                {/* [CONTROLS OVERLAY] Zoom & Torch */}
                {status === 'SCANNING' && (
                    <Box style={{ 
                        position: 'absolute', 
                        bottom: 16, 
                        right: 16, 
                        left: 16,
                        zIndex: 20,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between'
                    }}>
                        {/* Zoom Slider */}
                        {zoomRange.max > zoomRange.min ? (
                             <Box bg="rgba(0,0,0,0.5)" p="xs" style={{ borderRadius: 20, flex: 1, marginRight: hasTorch ? 16 : 0, backdropFilter: 'blur(4px)' }}>
                                <Group gap={8}>
                                    <IconZoomOut size={16} color="white" />
                                    <Slider 
                                        value={zoom} 
                                        onChange={handleZoomChange}
                                        min={zoomRange.min} 
                                        max={zoomRange.max} 
                                        step={0.1}
                                        label={null}
                                        style={{ flex: 1 }}
                                        color="blue"
                                        thumbSize={20}
                                    />
                                    <IconZoomIn size={16} color="white" />
                                    <Text size="xs" c="dimmed" w={24} ta="right">{zoom.toFixed(1)}x</Text>
                                </Group>
                             </Box>
                        ) : <div />}

                        {/* Torch Button */}
                        {hasTorch && (
                            <ActionIcon 
                                variant={torchOn ? "filled" : "light"} 
                                color={torchOn ? "yellow" : "gray"}
                                size={42} 
                                radius="xl"
                                onClick={handleTorchToggle}
                                style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}
                            >
                                {torchOn ? <IconBolt size={24} /> : <IconBoltOff size={24} />}
                            </ActionIcon>
                        )}
                    </Box>
                )}

                {/* VISUAL OVERLAY - Edge Lighting Only (No Color Overlay) */}
                <Transition mounted={isActive} transition="fade" duration={150} timingFunction="ease-out">
                    {(styles) => (
                        <div style={{
                            ...styles,
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 9999,
                            pointerEvents: 'none',
                            // Edge Lighting: Reduced glow (40% smaller) - camera area only
                            border: 'none',
                            boxShadow: `inset 0 0 48px 24px ${getFeedbackColor()}90`,
                            // No background overlay - camera stays clear
                            backgroundColor: 'transparent',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                             <Stack align="center" gap={4} style={{ 
                                background: type === 'error' 
                                    ? 'linear-gradient(135deg, rgba(250, 82, 82, 0.80) 0%, rgba(200, 40, 40, 0.80) 100%)'
                                    : type === 'warning'
                                    ? 'linear-gradient(135deg, rgba(253, 126, 20, 0.80) 0%, rgba(230, 100, 0, 0.80) 100%)'
                                    : 'linear-gradient(135deg, rgba(55, 178, 77, 0.80) 0%, rgba(40, 140, 60, 0.80) 100%)',
                                padding: '16px 24px', 
                                borderRadius: '16px', 
                                boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px ${getFeedbackColor()}40`,
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${getFeedbackColor()}80` 
                            }}>
                                {type === 'success' && <IconCheck size={36} color="#40C057" stroke={3} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />}
                                {type === 'warning' && <IconAlertTriangle size={36} color="#FD7E14" stroke={3} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />}
                                {type === 'error' && <IconX size={36} color="#FA5252" stroke={3} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />}
                                {message && (
                                    <Text c="white" fw={700} size="sm" ta="center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                        {message}
                                    </Text>
                                )}
                                {subMessage && (
                                    <Text c="white" fw={800} size="md" ta="center" maw={280} style={{ lineHeight: 1.4, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                        {subMessage}
                                    </Text>
                                )}
                            </Stack>
                        </div>
                    )}
                </Transition>

                {/* Camera Element */}
                <div id={mountNodeId} style={{ width: '100%', height: '100%' }} />
            </Box>


            {/* 2. Bottom Section: Work Stats - 50% Height (Scrollable) */}
            <Box style={{ flex: 1, backgroundColor: '#141517', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Stats Header */}
                <Box py="xs" px="md" bg="#1A1B1E" style={{ borderBottom: '1px solid #2C2E33', flexShrink: 0 }}>
                    <Group justify="space-between">
                        <Text fw={700} size="md">작업 현황</Text>
                        <Text fw={700} size="md" c="dimmed">총 {totalCount}개</Text>
                    </Group>
                </Box>

                {/* Stats List - Scrollable Area */}
                <ScrollArea style={{ flex: 1 }} p="md" offsetScrollbars>
                    <Stack gap="lg" pb="xl">
                        {statsSections.length === 0 && (
                             <Text c="dimmed" size="sm" ta="center" mt="xl">대기 중... 용기를 스캔해주세요.</Text>
                        )}
                        
                        {statsSections.map((section) => (
                            section.count > 0 && (
                                <Box key={section.key}>
                                    <Group justify="space-between" mb="xs">
                                        <Text fw={700} size="md" c={section.color}>{section.label}</Text>
                                        <Text fw={700} c={section.color}>{section.count}</Text>
                                    </Group>
                                    <Stack gap="xs">
                                        {Object.entries(section.items).map(([key, count]) => {
                                            const [gasType, containerType] = key.split(':');
                                            const isRack = containerType === 'RACK';
                                            
                                            return (
                                                <Group key={key} justify="space-between" p="sm" style={{ 
                                                    backgroundColor: `rgba(${getColorType(section.color)}, 0.1)`, 
                                                    borderRadius: '8px', 
                                                    border: `1px solid rgba(${getColorType(section.color)}, 0.3)` 
                                                }}>
                                                    <GasBadge gasType={gasType} size="md" isRack={isRack} />
                                                    <Text size="lg" fw={800} c={section.color}>{count}</Text>
                                                </Group>
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            )
                        ))}
                    </Stack>
                </ScrollArea>

                <Box p="md" bg="#1A1B1E" style={{ borderTop: '1px solid #333', flexShrink: 0 }}>
                    <Button fullWidth size="lg" color="blue" onClick={onClose}>
                        작업 완료 (닫기)
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
