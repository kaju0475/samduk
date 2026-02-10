import { Modal, Stack, Group, TextInput, Button, Text, Badge, ActionIcon, ScrollArea, Table } from '@mantine/core';
import { useState, useRef } from 'react';
import { IconPlus, IconTrash, IconBarcode } from '@tabler/icons-react';
import { Cylinder } from '@/lib/types';
import { notifications } from '@mantine/notifications';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface RackCylinderManagerProps {
    opened: boolean;
    onClose: () => void;
    addedSerials: string[];
    onAdd: (serial: string) => void;
    onRemove: (serial: string) => void;
    maxCount: number;
    allCylinders: Cylinder[];
}

export function RackCylinderManager({ 
    opened, onClose, addedSerials, onAdd, onRemove, maxCount, allCylinders 
}: RackCylinderManagerProps) {
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const handleClose = useModalBackTrap(opened, onClose, 'rack-manager');

    const handleAdd = () => {
        const raw = input.trim().toUpperCase();
        if (!raw) return;

        if (addedSerials.includes(raw)) {
            notifications.show({ title: '중복', message: '이미 추가된 용기입니다.', color: 'orange' });
            setInput('');
            return;
        }

        if (addedSerials.length >= maxCount) {
             notifications.show({ title: '수량 초과', message: `최대 ${maxCount}개까지만 담을 수 있습니다.`, color: 'red' });
             return;
        }

        // Strict Existence Check
        const exists = allCylinders.find(c => c.serialNumber.toUpperCase() === raw);
        if (!exists) {
            notifications.show({ title: '등록되지 않음', message: '존재하지 않는 용기입니다. 먼저 용기를 등록해주세요.', color: 'red' });
            return;
        }
        
        // Allowed Status Check (Optional: Should we prevent adding 'Lost' items? Maybe allow all for flexibility)

        onAdd(raw);
        setInput('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={handleClose} 
            title={`용기 관리 (${addedSerials.length} / ${maxCount})`}
            size="lg"
            centered
            closeOnEscape={false}
        >
            <Stack>
                <Group>
                    <TextInput 
                        ref={inputRef}
                        placeholder="용기번호 스캔 또는 입력 (Enter)"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        leftSection={<IconBarcode size={16} />}
                        style={{ flex: 1 }}
                        data-autofocus
                    />
                    <Button onClick={handleAdd} leftSection={<IconPlus size={16} />}>추가</Button>
                </Group>

                <ScrollArea h={300} type="always" offsetScrollbars>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>No.</Table.Th>
                                <Table.Th>용기번호</Table.Th>
                                <Table.Th>가스</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>관리</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {addedSerials.map((serial, index) => {
                                const info = allCylinders.find(c => c.serialNumber === serial);
                                return (
                                    <Table.Tr key={serial}>
                                        <Table.Td>{index + 1}</Table.Td>
                                        <Table.Td>
                                            <Text fw={700}>{serial}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            {info ? <Badge color={info.gasType.includes('수소') ? 'orange' : 'gray'} variant="light">{info.gasType}</Badge> : '-'}
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>
                                            <ActionIcon color="red" variant="subtle" onClick={() => onRemove(serial)}>
                                                <IconTrash size={16} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                            {addedSerials.length === 0 && (
                                <Table.Tr>
                                    <Table.Td colSpan={4} style={{ textAlign: 'center', color: '#868e96', padding: '20px' }}>
                                        등록된 용기가 없습니다.
                                    </Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
                
                <Group justify="flex-end">
                    <Button onClick={onClose} variant="default">닫기</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
