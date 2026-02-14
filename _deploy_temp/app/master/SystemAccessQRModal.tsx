'use client';

import { Modal, Text, Stack, Button, Box, CopyButton, Tooltip, ActionIcon, Group } from '@mantine/core';
import { IconCopy, IconCheck, IconDeviceMobile } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface SystemAccessQRModalProps {
    opened: boolean;
    onClose: () => void;
}

export function SystemAccessQRModal({ opened, onClose }: SystemAccessQRModalProps) {
    const [qrUrl, setQrUrl] = useState<string>('');
    const [systemUrl, setSystemUrl] = useState<string>('');

    useEffect(() => {
        if (opened) {
            // Fixed Production URL as requested
            const url = 'https://samduk.vercel.app/master';
            setSystemUrl(url);

            QRCode.toDataURL(url, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#1A1B1E',
                    light: '#FFFFFF'
                }
            })
            .then(dataUrl => setQrUrl(dataUrl))
            .catch(err => console.error(err));
        }
    }, [opened]);

    return (
        <Modal 
            opened={opened} 
            onClose={onClose}
            title={
                <Group gap="xs">
                    <IconDeviceMobile size={20} color="#40C057" />
                    <Text fw={700}>모바일 시스템 접속</Text>
                </Group>
            }
            centered
            size="md"
        >
            <Stack align="center" gap="md" py="md">
                <Text size="sm" c="dimmed" ta="center">
                    아래 QR코드를 휴대폰 카메라로 스캔하면<br />
                    모바일 시스템으로 즉시 연결됩니다.
                </Text>

                <Box 
                    p="lg" 
                    bg="white" 
                    style={{ 
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        border: '1px solid #eee'
                    }}
                >
                    {qrUrl ? (
                        <img 
                            src={qrUrl} 
                            alt="System Access QR" 
                            style={{ 
                                width: '240px', 
                                height: '240px',
                                display: 'block' 
                            }} 
                        />
                    ) : (
                        <Box w={240} h={240} bg="#f1f3f5" style={{ borderRadius: '8px' }} />
                    )}
                </Box>

                <Box 
                    w="100%" 
                    p="sm" 
                    bg="dark.8" 
                    style={{ borderRadius: '8px', border: '1px solid #373A40' }}
                >
                    <Group justify="space-between" wrap="nowrap">
                        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                            {systemUrl}
                        </Text>
                        <CopyButton value={systemUrl} timeout={2000}>
                            {({ copied, copy }) => (
                                <Tooltip label={copied ? '복사됨' : '주소 복사'} withArrow position="left">
                                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </CopyButton>
                    </Group>
                </Box>

                <Button fullWidth onClick={onClose} variant="light" color="gray" mt="sm">
                    닫기
                </Button>
            </Stack>
        </Modal>
    );
}
