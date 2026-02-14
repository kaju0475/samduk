
'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Title, Button, Group, Stack, TextInput, Text, TagsInput, Loader } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react'; // Changed icon
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { GlassCard } from '@/components/UI/GlassCard';
import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function CompanySettingsPage() {
    const { user, isAuthorized, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [companyName, setCompanyName] = useState('');
    const [aliases, setAliases] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== '관리자')) {
            notifications.show({ title: '접근 거부', message: '관리자만 접근할 수 있습니다.', color: 'red' });
            router.replace('/system');
        }
    }, [user, authLoading, router]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system/company');
            const data = await res.json();
            if (data.success) {
                setCompanyName(data.data.companyName || '삼덕가스공업(주)');
                setAliases(data.data.aliases || ['삼덕', 'SDG']);
            }
        } catch (error) {
            console.error(error);
             notifications.show({ title: '오류', message: '설정을 불러오지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized && user?.role === '관리자') {
            fetchSettings();
        }
    }, [isAuthorized, user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/system/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, aliases }),
            });
            const data = await res.json();
            
            if (data.success) {
                notifications.show({ title: '저장 완료', message: '회사 정보가 업데이트되었습니다.', color: 'green', icon: <IconCheck size={16}/> });
            } else {
                throw new Error(data.message);
            }
        } catch (err: any) {
            notifications.show({ title: '저장 실패', message: err.message, color: 'red' });
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || !user || user.role !== '관리자') {
        return null; 
    }

    return (
        <AppLayout title="회사 정보 및 별칭 관리" mainBg="transparent">
            <Stack gap="xl">
                <GlassCard>
                    <Group justify="space-between" align="start" mb="lg">
                        <Stack gap="xs">
                            <Title order={3} c="white">회사 정보 설정</Title>
                            <Text c="dimmed" size="sm">
                                시스템 전반에 표시되는 회사명과 용기 스캔 시 인식할 별칭(Alias)을 관리합니다.
                            </Text>
                        </Stack>
                        <Button 
                            leftSection={<IconCheck size={20} />} 
                            size="md" 
                            color="blue" 
                            loading={saving}
                            onClick={handleSave}
                        >
                            변경사항 저장
                        </Button>
                    </Group>

                    {loading ? (
                        <Group justify="center" p="xl"><Loader color="blue" /></Group>
                    ) : (
                        <Stack gap="lg" maw={600}>
                            <TextInput
                                label="회사명 (정식 명칭)"
                                description="시스템 타이틀, 리포트 헤더 등에 사용됩니다."
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                size="md"
                                withAsterisk
                            />
                            
                            <TagsInput
                                label="회사 별칭 (Alias)"
                                description="QR 코드 스캔 시, 소유자가 이 별칭에 포함되면 '자사'로 인식합니다. (Enter로 추가)"
                                placeholder="예: 삼덕, SDG, SD"
                                value={aliases}
                                onChange={setAliases}
                                size="md"
                                clearable
                            />
                        </Stack>
                    )}
                </GlassCard>
            </Stack>
        </AppLayout>
    );
}
