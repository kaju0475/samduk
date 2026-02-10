'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Title, Button, Group, Stack, Card, Text, Divider, Alert, Badge, Loader } from '@mantine/core';
import { IconDatabase, IconAlertCircle, IconExternalLink, IconBrandGithub, IconRotateClockwise, IconCheck } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { GlassCard } from '@/components/UI/GlassCard';
import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface GitHubBackup {
    id: number;
    name: string;
    size_in_bytes: number;
    created_at: string;
    download_url: string;
}

interface BackupStatus {
    loading: boolean;
    backups: GitHubBackup[];
    apiStatus: 'connected' | 'error' | 'auth_required';
    error: string | null;
}

export default function BackupPage() {
    // Admin Guard
    const { user, isAuthorized, isLoading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && (!user || user.role !== '관리자')) {
            notifications.show({ title: '접근 거부', message: '관리자만 접근할 수 있습니다.', color: 'red' });
            router.replace('/system');
        }
    }, [user, authLoading, router]);

    const [state, setState] = useState<BackupStatus>({
        loading: true,
        backups: [],
        apiStatus: 'connected',
        error: null,
    });

    const fetchBackups = async () => {
        try {
            const res = await fetch('/api/system/backup');
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            setState({
                loading: false,
                backups: data.backups || [],
                apiStatus: data.status || 'connected',
                error: null
            });
        } catch (err: any) {
            setState(prev => ({
                ...prev, 
                loading: false, 
                error: err.message,
                apiStatus: 'error'
            }));
        }
    };

    useEffect(() => {
        if (isAuthorized && user?.role === '관리자') {
            fetchBackups();
        }
    }, [isAuthorized, user]);


    const handleCloudRestore = (backup: GitHubBackup) => {
        modals.openConfirmModal({
            title: '클라우드 백업 복구 (주의)',
            children: (
                <Text size="sm">
                    GitHub 클라우드에서 <b>{backup.name}</b>을(를) 다운로드하여 시스템을 복구하시겠습니까?
                    <br /><br />
                    <span style={{ color: 'red' }}>⚠️ 현재 데이터가 덮어씌워집니다.</span>
                    <br />
                    (복구 전 현재 상태가 자동으로 안전하게 백업됩니다.)
                </Text>
            ),
            labels: { confirm: '다운로드 및 복구', cancel: '취소' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                const id = notifications.show({
                    loading: true,
                    title: '클라우드 복구 중...',
                    message: 'GitHub에서 백업 파일을 다운로드하고 있습니다. (약 5~10초 소요)',
                    autoClose: false,
                    withCloseButton: false,
                });

                try {
                    const res = await fetch('/api/system/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: backup.download_url }),
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
                    
                    // Refresh to ensure we are in sync
                    fetchBackups();
                } catch (err: any) {
                    notifications.update({
                        id,
                        color: 'red',
                        title: '복구 실패',
                        message: err.message,
                        icon: <IconAlertCircle size={16} />,
                        autoClose: 5000,
                    });
                }
            },
        });
    };

    if (authLoading || !user || user.role !== '관리자') {
        return null; 
    }

    // Helper to format bytes
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <AppLayout title="시스템 백업 관리" mainBg="transparent">
            <Stack gap="xl">
                <GlassCard>
                    <Group justify="space-between" align="start">
                        <Stack gap="xs">
                            <Title order={3} c="white">데이터 백업 센터</Title>
                            <Text c="dimmed" size="sm">
                                GitHub 안전 금고에 보관된 시스템 백업 목록입니다.
                                <br />
                                모든 데이터는 매시간 자동으로 클라우드에 저장(30일 보관)됩니다.
                            </Text>
                        </Stack>
                        <Button 
                            component="a"
                            href="https://github.com/kaju0475/samduk/actions"
                            target="_blank"
                            rightSection={<IconExternalLink size={16} />} 
                            variant="light" 
                            color="gray"
                        >
                            GitHub Actions 바로가기
                        </Button>
                    </Group>

                    <Divider my="lg" label="클라우드 저장소 (GitHub Artifacts)" labelPosition="center" color="gray.7" />

                    {state.loading ? (
                        <Group justify="center" p="xl">
                            <Loader color="blue" />
                        </Group>
                    ) : state.error ? (
                        <Alert color="red" icon={<IconAlertCircle />}>
                            목록을 불러오지 못했습니다: {state.error}
                        </Alert>
                    ) : state.apiStatus === 'auth_required' ? (
                        <Alert color="orange" title="인증 필요" icon={<IconAlertCircle />}>
                            GitHub 저장소가 비공개(Private)로 설정되어 있거나 인증 토큰이 필요합니다.
                            <br />
                            관리자에게 <b>GITHUB_TOKEN</b> 설정을 요청하세요.
                        </Alert>
                    ) : state.backups.length === 0 ? (
                        <Stack align="center" py="xl">
                            <IconDatabase size={40} color="gray" style={{ opacity: 0.5 }} />
                            <Text c="dimmed">저장된 백업 파일이 없습니다. (GitHub Actions가 아직 실행되지 않았을 수 있습니다)</Text>
                        </Stack>
                    ) : (
                        <Stack gap="sm">
                            {state.backups.map((backup) => (
                                <Card key={backup.id} withBorder shadow="sm" p="sm" bg="dark.7" style={{ borderColor: '#333' }}>
                                    <Group justify="space-between">
                                        <Group>
                                            <IconBrandGithub size={24} color="white" />
                                            <div>
                                                <Text fw={600} size="sm" c="white">{backup.name}</Text>
                                                <Group gap="xs">
                                                    <Text size="xs" c="dimmed">
                                                        {new Date(backup.created_at).toLocaleString()}
                                                    </Text>
                                                    <Divider orientation="vertical" />
                                                    <Text size="xs" c="dimmed">
                                                        {formatBytes(backup.size_in_bytes)}
                                                    </Text>
                                                </Group>
                                            </div>
                                        </Group>
                                        
                                        <Group>
                                            <Badge color="green" variant="light" size="sm">Safe Cloud</Badge>
                                            <Button 
                                                variant="light" 
                                                color="orange" 
                                                size="xs" 
                                                fw={600}
                                                leftSection={<IconRotateClockwise size={14} />}
                                                onClick={() => handleCloudRestore(backup)}
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
