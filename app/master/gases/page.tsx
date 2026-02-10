'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Stack, TextInput, Button, Group, Table, ActionIcon, ColorInput, ScrollArea, LoadingOverlay, Badge, Title, Text, Checkbox, SimpleGrid } from '@mantine/core';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { GasItem } from '@/lib/types';
import { getGasColor } from '@/app/utils/gas';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';



export default function GasMasterPage() {
  const [items, setItems] = useState<GasItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);



  // Form State
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [color, setColor] = useState('#228BE6');

  // Error State
  const [errors, setErrors] = useState<{name?: string, capacity?: string}>({});

  // [Bulk Delete State]
  const [selectionMode, setSelectionMode] = useState<'NONE' | 'DELETE'>('NONE');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectionMode = (mode: 'DELETE') => {
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
          items.forEach(c => newSet.add(c.id));
      } else {
          items.forEach(c => newSet.delete(c.id));
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

  const isAllSelected = items.length > 0 && items.every(c => selectedIds.has(c.id));
  const isIndeterminate = items.some(c => selectedIds.has(c.id)) && !isAllSelected;

  const handleBulkDelete = async (force: boolean = false) => {
      if (selectedIds.size === 0) return;
      if (!force && !confirm(`${selectedIds.size}개의 항목을 삭제하시겠습니까?`)) return;

      setLoading(true);
      try {
          const ids = Array.from(selectedIds);
          // Use New Bulk API (Comma separated)
          const searchParams = new URLSearchParams();
          searchParams.set('ids', ids.join(','));
          if (force) searchParams.set('force', 'true');

          const res = await fetch(`/api/master/gases?${searchParams.toString()}`, { method: 'DELETE' });
          const result = await res.json();
          
          if (res.ok) {
              notifications.show({ title: '완료', message: `${selectedIds.size}개 삭제됨`, color: 'blue' });
              fetchItems();
              setSelectionMode('NONE');
              setSelectedIds(new Set());
          } else {
              if (res.status === 409 && result.requiresForce) {
                   if (confirm(result.message)) {
                       await handleBulkDelete(true);
                       return;
                   }
              }
              notifications.show({ title: '오류', message: result.message || '삭제 실패', color: 'red' });
          }
      } catch {
          notifications.show({ title: '오류', message: '삭제 중 오류 발생', color: 'red' });
      } finally {
          setLoading(false);
      }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master/gases');
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch {
      notifications.show({ title: '오류', message: '가스 목록 로드 실패', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Auto-set color based on name
  useEffect(() => {
    if (!editingId && name) {
        setColor(getGasColor(name.trim()));
    }
  }, [name, editingId]);

  const validate = () => {
      const newErrors: {name?: string, capacity?: string} = {};
      if (!name.trim()) newErrors.name = '가스명을 입력하세요';
      if (!capacity.trim()) newErrors.capacity = '용량을 입력하세요';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const url = '/api/master/gases';
      const method = editingId ? 'PUT' : 'POST';
      const body = { 
          id: editingId || undefined,
          name, 
          capacity, 
          color 
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        const isAdd = !editingId;
        notifications.show({ title: '성공', message: isAdd ? '추가되었습니다' : '수정되었습니다', color: 'blue' });
        fetchItems();

        if (isAdd && data.data) {
             setEditingId(null);
             setName('');
             setCapacity('');
             setColor('#228BE6');
             setErrors({});
        } else {
             handleCancelEdit();
        }
      } else {
        notifications.show({ title: '오류', message: data.message, color: 'red' });
      }
    } catch {
       notifications.show({ title: '오류', message: '네트워크 오류', color: 'red' });
    } finally {
      setLoading(false);
    }
  };



  const handleEdit = (item: GasItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCapacity(item.capacity);
    setColor(item.color || '#228BE6');
    setErrors({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setCapacity('');
    setColor('#228BE6');
    setErrors({});
  };

  return (
    <AppLayout title="가스 품목 관리" themeColor="#FAB005">
      <PageTransition>
      <Stack gap="lg">
        <GlassCard p="md">
            <form onSubmit={handleSubmit}>
                <Group justify="space-between" mb="md" align="center" wrap="nowrap">
                    <Title order={4}>가스 품목 등록/수정</Title>
                    <Group gap="xs">
                        {editingId ? (
                            <>
                                <Button color="gray" variant="outline" onClick={handleCancelEdit} size="xs">
                                    취소
                                </Button>
                                <Button type="submit" color="teal" leftSection={<IconEdit size={14}/>} size="xs">
                                    수정 저장
                                </Button>
                            </>
                        ) : (
                            <>
                                {selectionMode === 'DELETE' ? (
                                    <Group gap="xs">
                                        <Button color="red" onClick={() => handleBulkDelete(false)} disabled={selectedIds.size === 0} size="xs">
                                            삭제({selectedIds.size})
                                        </Button>
                                        <Button color="gray" variant="outline" onClick={() => toggleSelectionMode('DELETE')} size="xs">
                                            취소
                                        </Button>
                                    </Group>
                                ) : (
                                    <>
                                        <Button color="red" variant="outline" onClick={() => toggleSelectionMode('DELETE')} disabled={items.length === 0} size="xs">
                                            선택 삭제
                                        </Button>
                                        <Button type="submit" color="blue" leftSection={<IconPlus size={14}/>} size="xs">
                                            등록
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </Group>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <TextInput 
                        label={
                            <Group justify="space-between">
                                <Text size="sm" fw={500}>가스명</Text>
                                <Text size="xs" c="red">{errors.name}</Text>
                            </Group>
                        }
                        placeholder="예: 산소" 
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                        error={!!errors.name}
                        styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)' } }}
                    />
                    <TextInput 
                        label={
                            <Group justify="space-between">
                                <Text size="sm" fw={500}>용량</Text>
                                <Text size="xs" c="red">{errors.capacity}</Text>
                            </Group>
                        }
                        placeholder="예: 40L" 
                        value={capacity}
                        onChange={(e) => setCapacity(e.currentTarget.value)}
                        error={!!errors.capacity}
                        styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)' } }}
                    />
                    <ColorInput 
                        label="식별 색상" 
                        value={color}
                        onChange={setColor}
                        styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)' } }}
                    />
                </SimpleGrid>
            </form>
        </GlassCard>
        
        <GlassCard p="md" pos="relative">
            <LoadingOverlay visible={loading} overlayProps={{ radius: "sm", blur: 2 }} />
            <ScrollArea h="calc(100vh - 350px)" type="always" offsetScrollbars>
                <Table striped highlightOnHover stickyHeader>
                <Table.Thead bg="#25262B">
                     <Table.Tr>
                     {selectionMode === 'DELETE' && (
                         <Table.Th w={40} style={{ textAlign: 'center' }}>
                             <Checkbox 
                                checked={isAllSelected}
                                indeterminate={isIndeterminate}
                                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                             />
                         </Table.Th>
                     )}
                     <Table.Th style={{ color: '#fff' }}>식별</Table.Th>
                    <Table.Th style={{ color: '#fff' }}>가스명</Table.Th>
                    <Table.Th style={{ color: '#fff' }}>용량</Table.Th>
                    <Table.Th style={{ color: '#fff', textAlign: 'right' }}>관리</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {items.map((item, index) => (
                    <Table.Tr 
                        key={item.id}
                        style={{ 
                            animation: 'fadeInUp 0.3s ease forwards',
                            animationDelay: `${index * 0.05}s`,
                            opacity: 0
                        }}
                    >
                        {selectionMode === 'DELETE' && (
                            <Table.Td style={{ textAlign: 'center' }}>
                                <Checkbox 
                                    checked={selectedIds.has(item.id)}
                                    onChange={(e) => handleSelectRow(item.id, e.currentTarget.checked)}
                                />
                            </Table.Td>
                        )}
                        <Table.Td>
                            <Badge color={item.color} variant="filled" size="sm" circle w={20} h={20}></Badge>
                        </Table.Td>
                        <Table.Td style={{ fontWeight: 500 }}>{item.name}</Table.Td>
                        <Table.Td>{item.capacity}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                            <Group gap={4} justify="flex-end">
                                <ActionIcon variant="light" color="blue" onClick={() => handleEdit(item)}>
                                    <IconEdit size={16} />
                                </ActionIcon>
                                {/* Removed Individual Delete */}
                            </Group>
                        </Table.Td>
                    </Table.Tr>
                    ))}
                    {items.length === 0 && (
                        <Table.Tr>
                            <Table.Td colSpan={4} align="center" style={{ color: 'gray', padding: '40px' }}>
                                등록된 가스 품목이 없습니다.
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
                </Table>
            </ScrollArea>
        </GlassCard>
      </Stack>
      </PageTransition>


    </AppLayout>
  );
}
