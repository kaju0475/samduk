
'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Title, Button, Group, Stack, Card, Text, Divider, Alert, Badge, Loader } from '@mantine/core';
import { IconDatabase, IconCloudUpload, IconCheck, IconAlertCircle, IconRotateClockwise } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { GlassCard } from '@/components/UI/GlassCard';

interface BackupStatus {
    loading: boolean;
    backups: string[];
    error: string | null;
}

export default function BackupPage() {
    const [state, setState] = useState<BackupStatus>({
        loading: true,
        backups: [],
        error: null,
    });

    const [creating, setCreating] = useState(false);

    const fetchBackups = async () => {
        try {
            const res = await fetch('/api/system/backup');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setState(prev => ({ ...prev, loading: false, backups: data.backups || [] }));
        } catch (err) {
            const message = err instanceof Error ? err.message : '알 수 없는 오류';
            setState(prev => ({ ...prev, loading: false, error: message }));
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        setCreating(true);
        try {
            const res = await fetch('/api/system/backup', { method: 'POST' });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Backup failed');

            notifications.show({
                title: '백업 완료',
                message: data.message || '시스템 백업이 안전하게 저장되었습니다.',
                color: 'green',
                icon: <IconCheck size={16} />,
            });

            await fetchBackups(); // Refresh list
        } catch (err) {
            const message = err instanceof Error ? err.message : '알 수 없는 오류';
            notifications.show({
                title: '백업 실패',
                message,
                color: 'red',
                icon: <IconAlertCircle size={16} />,
            });
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = (filename: string) => {
        modals.openConfirmModal({
            title: '시스템 복구 (주의)',
            children: (
                <Text size="sm">
                    정말로 <b>{filename}</b> 시점으로 시스템을 되돌리시겠습니까?
                    <br /><br />
                    <span style={{ color: 'red' }}>⚠️ 현재 데이터가 이 백업 파일의 내용으로 덮어씌워집니다.</span>
                    <br />
                    (복구 전 현재 상태가 자동으로 백업됩니다.)
                </Text>
            ),
            labels: { confirm: '복구 시작', cancel: '취소' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                const id = notifications.show({
                    loading: true,
                    title: '복구 중...',
                    message: '시스템을 복구하고 있습니다. 잠시만 기다려주세요.',
                    autoClose: false,
                    withCloseButton: false,
                });

                try {
                    const res = await fetch('/api/system/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename }),
                    });
                    const data = await res.json();

                    if (!res.ok) throw new Error(data.error || 'Restore failed');

                    notifications.update({
                        id,
                        color: 'teal',
                        title: '복구 완료',
                        message: data.message,
                        icon: <IconCheck size={16} />,
                        autoClose: 5000,
                    });
                    
                    fetchBackups(); // Refresh list to show the auto-backup
                } catch (err) {
                    const message = err instanceof Error ? err.message : '알 수 없는 오류';
                    notifications.update({
                        id,
                        color: 'red',
                        title: '복구 실패',
                        message,
                        icon: <IconAlertCircle size={16} />,
                        autoClose: 5000,
                    });
                }
            },
        });
    };


    return (
        <AppLayout title="시스템 백업 관리" mainBg="transparent">
            <Stack gap="xl">
                <GlassCard>
                    <Group justify="space-between" align="start">
                        <Stack gap="xs">
                            <Title order={3} c="white">데이터 백업 및 복구</Title>
                            <Text c="dimmed" size="sm">
                                시스템 데이터를 로컬 서버와 클라우드(Supabase)에 이중으로 백업합니다.
                                <br />
                                정기적인 백업을 통해 데이터 유실을 방지하세요.
                            </Text>
                        </Stack>
                        <Button 
                            leftSection={<IconCloudUpload size={20} />} 
                            size="md" 
                            color="blue" 
                            loading={creating}
                            onClick={handleCreateBackup}
                        >
                            지금 백업 생성
                        </Button>
                    </Group>

                    <Divider my="lg" label="백업 이력 (로컬)" labelPosition="center" color="gray.7" />

                    {state.loading ? (
                        <Group justify="center" p="xl">
                            <Loader color="blue" />
                        </Group>
                    ) : state.error ? (
                        <Alert color="red" icon={<IconAlertCircle />}>
                            백업 목록을 불러오는데 실패했습니다: {state.error}
                        </Alert>
                    ) : state.backups.length === 0 ? (
                        <Text ta="center" c="dimmed" py="xl">저장된 백업 파일이 없습니다.</Text>
                    ) : (
                        <Stack gap="sm">
                            {state.backups.map((filename) => (
                                <Card key={filename} withBorder shadow="sm" p="sm" bg="dark.7" style={{ borderColor: '#333' }}>
                                    <Group justify="space-between">
                                        <Group>
                                            <IconDatabase size={20} color="#4dabf7" />
                                            <Text fw={500} size="sm" c="gray.3">{filename}</Text>
                                        </Group>
                                        <Group>
                                            <Badge color="gray" variant="light" size="sm">Local</Badge>
                                            <Button 
                                                variant="subtle" 
                                                color="red" 
                                                size="xs" 
                                                leftSection={<IconRotateClockwise size={14} />}
                                                onClick={() => handleRestore(filename)}
                                            >
                                                복구
                                            </Button>
                                        </Group>
                                    </Group>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </GlassCard>
            </Stack>
        </AppLayout>
    );
}
