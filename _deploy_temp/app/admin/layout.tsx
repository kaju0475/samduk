
'use client';
import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Center, Loader, Text } from '@mantine/core';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthorized, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace('/auth/login');
            } else if (user.role !== '관리자') {
                router.replace('/');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <Center h="100vh">
                <Loader color="red" />
            </Center>
        );
    }

    if (!user || user.role !== '관리자') {
        return (
            <Center h="100vh">
                <Text c="dimmed">접근 권한이 없습니다.</Text>
            </Center>
        );
    }

    return <>{children}</>;
}
