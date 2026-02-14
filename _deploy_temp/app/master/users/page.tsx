'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { 
  Text, Button, Table, Modal, TextInput, Select, Checkbox,
  ActionIcon, Group, Badge, Stack, SimpleGrid, ScrollArea, PasswordInput, Box
} from '@mantine/core';
import { useState, useEffect, useMemo } from 'react';
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { User, UserRole } from '@/lib/types';
import { useDisclosure } from '@mantine/hooks';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { QRPrintModal } from '@/components/Common/QRPrintModal';
// import { IconPrinter } from '@tabler/icons-react';
import { UserHistoryModal } from '@/components/History/UserHistoryModal';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { StaggerContainer } from '@/components/UI/StaggerContainer';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [qrModalOpened, { open: openQrModal, close: closeQrModal }] = useDisclosure(false);
  const [printTarget, setPrintTarget] = useState<User | null>(null); // [New]
  const [editingUser, setEditingUser] = useState<User | null>(null); // [New] Edit Mode
  const [isAdmin, setIsAdmin] = useState(false);
    const [qrTokens, setQrTokens] = useState<Record<string, string>>({}); // [Secure QR]
    
    // [Stable] Fixed Production URL is mandatory for printed QR codes to work cross-device.
    // Using window.location.origin during print would embed 'localhost' if printed from Dev PC.
    const ORIGIN_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://samduk.vercel.app';

    // [Secure QR] Fetch encrypted tokens before printing
    const fetchQrTokens = async (userIds: string[]) => {
        try {
            const res = await fetch('/api/auth/qr-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds }),
            });
            const data = await res.json();
            if (data.success) {
                setQrTokens(prev => ({ ...prev, ...data.tokens }));
                return true;
            }
        } catch (e) {
            console.error('[QR Token Fetch Error]', e);
            notifications.show({ title: '오류', message: '보안 QR 토큰 생성 실패', color: 'red' });
        }
        return false;
    };

    // History Modal State
    const [historyModalOpen, { open: openHistory, close: closeHistory }] = useDisclosure(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');

    // [Selection State]
    const [selectionMode, setSelectionMode] = useState<'NONE' | 'DELETE' | 'QR'>('NONE');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // const [origin, setOrigin] = useState('');
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const sessionUser = sessionStorage.getItem('currentUser');
          // ... rest of checking logic

          const localUser = localStorage.getItem('currentUser');
          let user = null;
          
          if (sessionUser) {
              try { user = JSON.parse(sessionUser); } catch {}
          } else if (localUser) {
              try { user = JSON.parse(localUser); } catch {}
          }

      if (user) {
              const role = (user.role || '').toLowerCase();
              if (role === '관리자' || role === 'admin' || role === 'master') {
                  setIsAdmin(true);
              } else {
                  // [Guard] Non-admin redirect
                  notifications.show({ title: '접근 거부', message: '관리자만 접근할 수 있습니다.', color: 'red' });
                  window.location.replace('/');
              }
          } else {
             // Not logged in
             window.location.replace('/auth/login');
          }
      }
  }, []);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Override handleClose to clear edit state
  const handleModalClose = () => {
      close();
      setEditingUser(null);
      setNewUsername('');
      setNewName('');
      setNewPassword('');
  };

  // Back Button Logic
  const handleClose = useModalBackTrap(opened, handleModalClose, 'create-user');

  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('사용자');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/master/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch {
      notifications.show({ title: '오류', message: '사용자 목록을 불러오는데 실패했습니다', color: 'red' });
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => users.filter(user => 
    user.name.includes(searchQuery) ||
    user.username.includes(searchQuery)
  ), [users, searchQuery]);

  // [Bulk Actions]
  const toggleSelectionMode = (mode: 'DELETE' | 'QR') => {
      if (selectionMode === mode) {
          setSelectionMode('NONE');
          setSelectedIds(new Set());
      } else {
          setSelectionMode(mode);
          setSelectedIds(new Set());
      }
  };

  const handleSelectAll = (checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) {
          filteredUsers.forEach(u => newSet.add(u.id));
      } else {
          filteredUsers.forEach(u => newSet.delete(u.id));
      }
      setSelectedIds(newSet);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) {
          newSet.add(id);
      } else {
          newSet.delete(id);
      }
      setSelectedIds(newSet);
  };

  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.id));
  const isIndeterminate = filteredUsers.some(u => selectedIds.has(u.id)) && !isAllSelected;

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      if (!confirm(`${selectedIds.size}명의 사용자를 삭제하시겠습니까?`)) return;

      const ids = Array.from(selectedIds);
      setLoading(true);
      
      try {
          const searchParams = new URLSearchParams();
          searchParams.set('ids', ids.join(','));
          const res = await fetch(`/api/master/users?${searchParams.toString()}`, { method: 'DELETE' });
          const result = await res.json();

          if (res.ok) {
              notifications.show({ title: '완료', message: result.message, color: 'blue' });
              fetchUsers();
              setSelectionMode('NONE');
              setSelectedIds(new Set());
          } else {
              notifications.show({ title: '오류', message: result.message, color: 'red' });
          }
      } catch {
          notifications.show({ title: '오류', message: '오류 발생', color: 'red' });
      } finally {
          setLoading(false);
      }
  };

  // [Fix] Corrected Bulk QR Logic
  const handleBulkQr = async () => {
      if (selectedIds.size === 0) return;
      setLoading(true);
      await fetchQrTokens(Array.from(selectedIds));
      setLoading(false);

      setPrintTarget(null); // Clear single target
      openQrModal();
  };

  const handleSaveUser = async (shouldPrint: boolean = false) => {
    // If editing, password is optional (empty = no change)
    if (!editingUser && !newPassword) {
         notifications.show({ title: '오류', message: '비밀번호는 필수입니다', color: 'red' });
         return;
    }
    if (!newUsername || !newName) {
        notifications.show({ title: '오류', message: '이름과 아이디는 필수입니다', color: 'red' });
        return;
    }
    
    setLoading(true);
    try {
      const url = '/api/master/users';
      const method = editingUser ? 'PUT' : 'POST';
      const body = { 
            id: editingUser?.id, // Undefined for POST
            username: newUsername, 
            name: newName, 
            password: newPassword, // API handles empty password for PUT
            role: newRole
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        notifications.show({ title: '성공', message: editingUser ? '사용자 정보가 수정되었습니다' : '사용자가 추가되었습니다', color: 'blue' });
        handleClose();
        await fetchUsers();
        // Reset form
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        setNewRole('사용자');
        setEditingUser(null);

        // [New] Handle Print
        if (shouldPrint && data.data) {
             setPrintTarget(data.data);
             if (data.data.id) await fetchQrTokens([data.data.id]);
             setTimeout(() => openQrModal(), 100);
        } else {
             setPrintTarget(null);
        }

      } else {
        notifications.show({ title: '오류', message: data.message || '저장 실패', color: 'red' });
      }
    } catch {
       notifications.show({ title: '오류', message: '네트워크 오류', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
      setEditingUser(user);
      setNewUsername(user.username);
      setNewName(user.name);
      setNewRole(user.role);
      setNewPassword(''); // Don't show password
      open();
  };

  const handleDeleteUser = async (user: User) => {
    modals.openConfirmModal({
        title: '삭제 확인',
        children: (
            <Text size="sm">&apos;{user.name}&apos; 사용자를 정말 삭제하시겠습니까?</Text>
        ),
        labels: { confirm: '예', cancel: '아니요' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/master/users?id=${user.id}`, { method: 'DELETE' });
                if (res.ok) {
                     notifications.show({ title: '성공', message: '사용자가 삭제되었습니다', color: 'blue' });
                     fetchUsers();
                } else {
                     const errorData = await res.json();
                     notifications.show({ title: '오류', message: errorData.message || '삭제 실패', color: 'red' });
                }
            } catch {
                notifications.show({ title: '오류', message: '오류 발생', color: 'red' });
            } finally {
                setLoading(false);
            }
        }
    });
  };



  const handleHistoryClick = (id: string, name: string) => {
      setSelectedUserId(id);
      setSelectedUserName(name);
      openHistory();
  };

  const getRoleColor = (role: UserRole) => {
      switch(role) {
          case '관리자': return 'red';
          case '사용자': return 'teal';
          default: return 'gray';
      }
  };

  return (
    <AppLayout title="사용자 관리" themeColor="#FA5252">
      <Group justify="space-between" mb="lg">
        <div>
            <Text c="white" fw={900} style={{ fontSize: '2rem' }} visibleFrom="sm">사용자 목록</Text>
            <Text c="gray.4" size="xs" visibleFrom="sm">총 {filteredUsers.length}명의 사용자가 등록되었습니다</Text>
        </div>
        
        <Group gap="xs" style={{ flex: 1, justifyContent: 'flex-end' }} align="stretch">
             <TextInput 
                placeholder="이름, 아이디 검색" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                rightSection={
                    searchQuery ? (
                        <ActionIcon variant="transparent" color="gray" onClick={() => setSearchQuery('')}>
                            <IconTrash size={16} />
                        </ActionIcon>
                    ) : null
                }
                style={{ flex: 1 }}
                w={{ base: 'auto', sm: '250px' }}
                miw={{ base: '150px', sm: '250px' }}
                size="md"
            />
            {isAdmin && (
                <Button 
                    leftSection={<IconPlus size={20}/>} 
                    onClick={open} 
                    color="red" 
                    size="md"
                    h="auto"
                >
                    <Text fw={700} style={{ fontSize: '1rem' }} visibleFrom="sm">신규 등록</Text>
                    <Text fw={700} style={{ fontSize: '0.9rem' }} hiddenFrom="sm">등록</Text>
                </Button>
            )}
            
            {/* [Bulk Actions Toolbar] */}
            {isAdmin && (
                <Group gap={4}>
                     {selectionMode === 'DELETE' ? (
                         <Button.Group>
                             <Button color="red" size="md" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
                                 <Text visibleFrom="sm">선택 삭제 ({selectedIds.size})</Text>
                                 <Text hiddenFrom="sm">삭제 ({selectedIds.size})</Text>
                             </Button>
                             <Button color="gray" size="md" onClick={() => toggleSelectionMode('DELETE')}>취소</Button>
                         </Button.Group>
                     ) : (
                         <Button
                            onClick={() => toggleSelectionMode('DELETE')}
                            color="red"
                            variant="outline"
                            size="md"
                            disabled={selectionMode !== 'NONE'}
                        >
                            <Text fw={700} style={{ fontSize: '1rem' }} visibleFrom="sm">삭제</Text>
                            <Text fw={700} style={{ fontSize: '0.9rem' }} hiddenFrom="sm">삭제</Text>
                        </Button>
                     )}
                     
                     <Button
                        onClick={selectionMode === 'QR' ? handleBulkQr : () => toggleSelectionMode('QR')}
                        color="orange"
                        variant={selectionMode === 'QR' ? 'filled' : 'outline'}
                        size="md"
                        disabled={selectionMode === 'DELETE'}
                    >
                         {selectionMode === 'QR' ? `선택 출력 (${selectedIds.size})` : 'QR 출력'}
                    </Button>
                    {selectionMode === 'QR' && (
                        <Button color="gray" size="md" onClick={() => toggleSelectionMode('QR')} visibleFrom="sm">취소</Button>
                    )}
                </Group>
             )}
        </Group>
      </Group>

      {/* Desktop View */}
      <PageTransition>
      <Box>
      <GlassCard p="md" radius="lg" visibleFrom="sm" style={{ 
            border: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <ScrollArea>
            <Table verticalSpacing="xs" style={{ minWidth: '800px' }}>
            <Table.Thead>
                <Table.Tr>
                {selectionMode !== 'NONE' && (
                    <Table.Th w={40} style={{ textAlign: 'center' }}>
                         <Checkbox 
                            checked={isAllSelected}
                            indeterminate={isIndeterminate}
                            onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                            color="red"
                        />
                    </Table.Th>
                )}
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem'}}>이름</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem'}}>아이디</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem'}}>권한</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem'}}>이력</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem'}}>관리</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {filteredUsers.map((user, index) => (
                    <Table.Tr 
                        key={user.id} 
                        style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            animation: 'fadeInUp 0.3s ease forwards',
                            animationDelay: `${index * 0.05}s`,
                            opacity: 0,
                            cursor: selectionMode !== 'NONE' ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                            if (selectionMode !== 'NONE') handleSelectRow(user.id, !selectedIds.has(user.id));
                        }}
                    >
                         {selectionMode !== 'NONE' && (
                            <Table.Td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={selectedIds.has(user.id)}
                                  onChange={(e) => handleSelectRow(user.id, e.currentTarget.checked)}
                                  color="red"
                                />
                            </Table.Td>
                        )}
                        <Table.Td style={{color: 'white', fontSize: '0.95rem'}} fw={700}>{user.name}</Table.Td>
                        <Table.Td style={{color: 'white', fontSize: '0.95rem'}}>{user.username}</Table.Td>
                        <Table.Td>
                            <Badge color={getRoleColor(user.role)} variant="light" size="sm">{user.role}</Badge>
                        </Table.Td>
                        <Table.Td>
                            <Button size="compact-xs" variant="light" color="gray" onClick={(e) => { e.stopPropagation(); handleHistoryClick(user.id, user.name); }}>
                                이력
                            </Button>
                        </Table.Td>
                        <Table.Td>
                            <Group gap={4}>
                                <ActionIcon 
                                    variant="subtle" 
                                    color="gray" 
                                    size="sm" 
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setPrintTarget(user);
                                        await fetchQrTokens([user.id]); // Fetch secure token
                                        openQrModal();
                                    }}
                                    title="QR 출력"
                                >
                                    <Text fw={900} size="xs">QR</Text>
                                </ActionIcon>
                                <ActionIcon variant="subtle" color="blue" size="sm" onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                                    <IconEdit size={16} />
                                </ActionIcon>
                                <ActionIcon variant="subtle" color="red" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}>
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Group>
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
            </Table>
        </ScrollArea>
      </GlassCard>

      {/* Mobile Card View */}
      <StaggerContainer>
      <SimpleGrid cols={1} hiddenFrom="sm" spacing="xs">
        {filteredUsers.map((user) => (
        <GlassCard key={user.id} p="sm" variant="interactive" style={{
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
             onClick={() => {
                if (selectionMode !== 'NONE') handleSelectRow(user.id, !selectedIds.has(user.id));
            }}
        >
                <Group justify="space-between" mb={4}>
                    <Group gap={8}>
                         {selectionMode !== 'NONE' && (
                            <Checkbox 
                                checked={selectedIds.has(user.id)}
                                onChange={() => {}} // Handled by Card Click
                                color="red"
                                onClick={(e) => e.stopPropagation()} // Prevent double toggle if needed
                            />
                        )}
                        <Text fw={700} c="white" size="md">{user.name}</Text>
                        <Text c="dimmed" size="xs">({user.username})</Text>
                    </Group>
                    <Badge color={getRoleColor(user.role)} variant="light" size="sm">{user.role}</Badge>
                </Group>
                
                <Group justify="flex-end" mt="xs">
                     <Button size="compact-xs" variant="light" color="gray" onClick={(e) => { e.stopPropagation(); handleHistoryClick(user.id, user.name); }} mr="xs">
                        이력
                    </Button>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={async (e) => {
                            e.stopPropagation();
                            setPrintTarget(user);
                            await fetchQrTokens([user.id]);
                            openQrModal();
                        }}
                        title="QR 출력"
                    >
                        <Text fw={900} size="xs">QR</Text>
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                        <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}>
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            </GlassCard>
        ))}
      </SimpleGrid>
      </StaggerContainer>
      </Box>
      </PageTransition>

      {/* Add User Modal */}
      <Modal opened={opened} onClose={handleClose} title={editingUser ? "사용자 정보 수정" : "신규 사용자 등록"} centered
        styles={{ 
            content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, 
            header: { backgroundColor: '#1A1B1E', color: 'white' },
        }}
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <Stack gap="md">
            <TextInput label="이름" placeholder="홍길동" required 
                value={newName} onChange={(e) => setNewName(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
            <TextInput label="아이디" placeholder="user1" required 
                value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
            <PasswordInput 
                label={editingUser ? "비밀번호 (변경시에만 입력)" : "비밀번호"} 
                placeholder="****" 
                required={!editingUser} 
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
            {/* [Fix] Mobile Crash Prevention: Use NativeSelect for touch devices to avoid Modal/Portal Focus Trap issues */}
            <Box visibleFrom="sm">
                <Select label="권한" 
                    data={['관리자', '사용자']}
                    value={newRole} onChange={(v) => setNewRole(v as UserRole)}
                    allowDeselect={false}
                    withAsterisk
                    comboboxProps={{ withinPortal: false }} // [Fix] Prevent Focus Trap Freeze on some devices
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, dropdown: { backgroundColor: '#25262B' }, option: { color: 'white' } }}
                />
            </Box>
            <Box hiddenFrom="sm">
                <Text size="sm" fw={500} mb={3}>권한 <span style={{color:'var(--mantine-color-red-filled)'}}>*</span></Text>
                <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        fontSize: '16px' // Prevent zoom on iOS
                    }}
                >
                    <option value="사용자" style={{color: 'black'}}>사용자</option>
                    <option value="관리자" style={{color: 'black'}}>관리자</option>
                </select>
            </Box>
            
            <Group grow mt="md">
                <Button onClick={() => handleSaveUser(false)} loading={loading} color="red" size="lg">
                    {editingUser ? '수정 저장' : '등록'}
                </Button>
                {isAdmin && (
                    <Button onClick={() => handleSaveUser(true)} loading={loading} color="orange" size="lg" variant="outline" style={{ minWidth: 'fit-content' }}>
                        저장 후 QR 인쇄
                    </Button>
                )}
            </Group>
        </Stack>
      </Modal>

      <QRPrintModal
        opened={qrModalOpened}
        onClose={() => {
            closeQrModal();
            setPrintTarget(null);
            setQrTokens({}); // Clear tokens on close
        }}
        title="사용자 (보안 QR)"

        data={(() => {
            const baseUrl = ORIGIN_URL;
            
            // [Stable] Standard URL Construction
            // We use the absolute production URL (or APP_URL) for all printed tokens.
            const makeUrl = (tokenOrId: string) => {
                const token = tokenOrId.startsWith('ENC-') ? tokenOrId.replace('ENC-', '') : tokenOrId;
                return `${baseUrl}/q/${token}`;
            };

            // 1. Single Print
            if (printTarget) {
                return [{
                    id: makeUrl(qrTokens[printTarget.id] || printTarget.id),
                    label: printTarget.name,
                    subLabel: printTarget.username,
                    desc: printTarget.role
                }];
            }
            // 2. Selection Mode
            if (selectionMode === 'QR' && selectedIds.size > 0) {
                return filteredUsers.filter(u => selectedIds.has(u.id)).map(u => ({
                    id: makeUrl(qrTokens[u.id] || u.id),
                    label: u.name,
                    subLabel: u.username,
                    desc: u.role
                }));
            }
            // 3. Default
            return filteredUsers.map(u => ({
                id: makeUrl(qrTokens[u.id] || u.id),
                label: u.name,
                subLabel: u.username,
                desc: u.role
            }));
        })()}
      />

      <UserHistoryModal 
        opened={historyModalOpen} 
        onClose={closeHistory} 
        userId={selectedUserId || ''} 
        userName={selectedUserName} 
      />
    </AppLayout>
  );
}
