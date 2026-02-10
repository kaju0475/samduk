
'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Title, Button, Group, Stack, Table, Badge, ActionIcon, Modal, TextInput, Select, PasswordInput, LoadingOverlay, Text } from '@mantine/core';
import { IconUserPlus, IconEdit, IconTrash, IconKey } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { GlassCard } from '@/components/UI/GlassCard';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    username: string; // Login ID
    name: string;
    role: UserRole;
    created_at: string;
}

export default function UserManagementPage() {
    // Admin Guard
    const { user, isAuthorized, isLoading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && (!user || user.role !== '관리자')) {
            notifications.show({ title: '접근 거부', message: '관리자만 접근할 수 있습니다.', color: 'red' });
            router.replace('/system');
        }
    }, [user, authLoading, router]);

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [processing, setProcessing] = useState(false);

    const form = useForm({
        initialValues: {
            id: '',
            username: '',
            name: '',
            password: '',
            role: '사용자' as UserRole,
        },
        validate: {
            username: (value) => !isEditing && (value.length < 3 ? '아이디는 3자 이상이어야 합니다.' : null),
            name: (value) => value.length < 2 ? '이름은 2자 이상이어야 합니다.' : null,
            password: (value) => !isEditing && (value.length < 4 ? '비밀번호는 4자 이상이어야 합니다.' : null),
        },
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/master/users');
            const data = await res.json();
             if (data.success) {
                setUsers(data.data);
            } else {
                throw new Error(data.message);
            }
        } catch (err: any) {
             notifications.show({
                title: '오류',
                message: err.message || '사용자 목록을 불러오지 못했습니다.',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized && user?.role === '관리자') {
            fetchUsers();
        }
    }, [isAuthorized, user]);

    const handleOpenCreate = () => {
        setIsEditing(false);
        form.reset();
        setModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setIsEditing(true);
        form.setValues({
            id: user.id,
            username: user.username,
            name: user.name,
            password: '', // Blank implies no change
            role: user.role,
        });
        setModalOpen(true);
    };

    const handleDelete = (user: User) => {
        modals.openConfirmModal({
            title: '사용자 삭제',
            children: (
                <Text size="sm">
                    정말로 <b>{user.name} ({user.username})</b> 사용자를 삭제하시겠습니까?
                </Text>
            ),
            labels: { confirm: '삭제', cancel: '취소' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/master/users?id=${user.id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (!data.success) throw new Error(data.message);

                     notifications.show({ title: '삭제 완료', message: '사용자가 삭제되었습니다.', color: 'green' });
                     fetchUsers();
                } catch (err: any) {
                    notifications.show({ title: '오류', message: err.message, color: 'red' });
                }
            }
        });
    };

    const handleSubmit = async (values: typeof form.values) => {
        setProcessing(true);
        try {
            const url = isEditing ? '/api/master/users' : '/api/master/users';
            const method = isEditing ? 'PUT' : 'POST';
            
            // For editing, only send password if changed
            const payload = { ...values };
            if (isEditing && !payload.password) delete (payload as any).password;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.message);

            notifications.show({ 
                title: isEditing ? '수정 완료' : '생성 완료', 
                message: isEditing ? '사용자 정보가 수정되었습니다.' : '새로운 사용자가 등록되었습니다.', 
                color: 'green' 
            });
            
            setModalOpen(false);
            fetchUsers();
        } catch (err: any) {
             notifications.show({ title: '오류', message: err.message, color: 'red' });
        } finally {
            setProcessing(false);
        }
    };

    if (authLoading || !user || user.role !== '관리자') {
        return null; // Or a loading spinner handled by layout
    }

    return (
        <AppLayout title="사용자 관리" mainBg="transparent">
            <Stack gap="xl">
                <GlassCard>
                    <Group justify="space-between" mb="lg">
                         <Stack gap="xs">
                            <Title order={3} c="white">시스템 사용자 관리</Title>
                            <Text c="dimmed" size="sm">
                                시스템에 접근할 수 있는 사용자를 등록하고 권한을 관리합니다.
                            </Text>
                        </Stack>
                        <Button 
                            leftSection={<IconUserPlus size={18} />} 
                            onClick={handleOpenCreate}
                        >
                            사용자 추가
                        </Button>
                    </Group>

                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>이름</Table.Th>
                                <Table.Th>아이디(로그인ID)</Table.Th>
                                <Table.Th>권한</Table.Th>
                                <Table.Th>생성일</Table.Th>
                                <Table.Th style={{ width: 100 }}>관리</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {loading ? (
                                <Table.Tr>
                                    <Table.Td colSpan={5} align="center">로딩 중...</Table.Td>
                                </Table.Tr>
                            ) : users.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={5} align="center">등록된 사용자가 없습니다.</Table.Td>
                                </Table.Tr>
                            ) : (
                                users.map((user) => (
                                    <Table.Tr key={user.id}>
                                        <Table.Td fw={500}>{user.name}</Table.Td>
                                        <Table.Td>{user.username}</Table.Td>
                                        <Table.Td>
                                            <Badge color={user.role === '관리자' ? 'red' : 'blue'}>
                                                {user.role}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>{new Date(user.created_at).toLocaleDateString()}</Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                <ActionIcon variant="light" color="blue" onClick={() => handleOpenEdit(user)}>
                                                    <IconEdit size={16} />
                                                </ActionIcon>
                                                <ActionIcon variant="light" color="red" onClick={() => handleDelete(user)}>
                                                    <IconTrash size={16} />
                                                </ActionIcon>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </GlassCard>
            </Stack>

            <Modal 
                opened={modalOpen} 
                onClose={() => setModalOpen(false)} 
                title={isEditing ? "사용자 수정" : "새 사용자 등록"}
                centered
            >
                 <LoadingOverlay visible={processing} />
                 <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        <TextInput 
                            label="아이디 (Login ID)" 
                            disabled={isEditing} 
                            description={isEditing && "아이디는 수정할 수 없습니다."}
                            withAsterisk
                            {...form.getInputProps('username')} 
                        />
                        <TextInput 
                            label="이름" 
                            withAsterisk
                            {...form.getInputProps('name')} 
                        />
                        <Select 
                            label="권한" 
                            data={['관리자', '사용자']}
                            withAsterisk
                            {...form.getInputProps('role')} 
                        />
                        <PasswordInput 
                            label={isEditing ? "비밀번호 (변경 시에만 입력)" : "비밀번호"} 
                            placeholder={isEditing ? "변경하지 않으려면 비워두세요" : "****"}
                            withAsterisk={!isEditing}
                            {...form.getInputProps('password')} 
                        />
                        <Group justify="flex-end" mt="md">
                            <Button variant="default" onClick={() => setModalOpen(false)}>취소</Button>
                            <Button type="submit" color="blue">{isEditing ? '수정' : '등록'}</Button>
                        </Group>
                    </Stack>
                 </form>
            </Modal>
        </AppLayout>
    );
}
