import { Modal, Table, Badge, ScrollArea, LoadingOverlay } from '@mantine/core';
import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/types';
import dayjs from 'dayjs';

interface UserHistoryModalProps {
    opened: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
}

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

export function UserHistoryModal({ opened, onClose, userId, userName }: UserHistoryModalProps) {
    const handleClose = useModalBackTrap(opened, onClose, 'user-history');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<Transaction[]>([]);

    useEffect(() => {
        if (opened && userId) {
            fetchHistory(userId);
        }
    }, [opened, userId]);

    const fetchHistory = async (id: string) => {
        setLoading(true);
        try {
            // We use the new dedicated endpoint for fetching user history
            // or we can reuse filtered logs if we don't want a new endpoint?
            // Let's assume we will create a dedicated API to ensure we get ALL history, not just recent 10 logs.
            const res = await fetch(`/api/master/users/history?workerId=${id}`);
            const json = await res.json();
            if (json.success) {
                setHistory(json.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={handleClose} 
            title={`${userName} 작업 이력`} 
            size="lg"
            centered
            closeOnEscape={false}
        >
             <LoadingOverlay visible={loading} />
             <ScrollArea h={500}>
                <Table stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: '140px' }}>일시</Table.Th>
                            <Table.Th style={{ width: '90px' }}>작업</Table.Th>
                            <Table.Th style={{ width: '130px' }}>용기번호</Table.Th>
                            <Table.Th>내용</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {history.length > 0 ? (
                            history.map((item) => (
                                <Table.Tr key={item.id}>
                                    <Table.Td>{dayjs(item.timestamp).format('YYYY-MM-DD HH:mm')}</Table.Td>
                                    <Table.Td>
                                        <Badge 
                                            color={
                                                ['납품'].includes(item.type) ? 'blue' :
                                                ['회수'].includes(item.type) ? 'green' :
                                                ['충전', '충전시작', '충전완료'].includes(item.type) ? 'orange' :
                                                ['검사출고', '검사입고'].includes(item.type) ? 'red' : 'gray'
                                            }
                                        >
                                            {item.type}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>{item.cylinderId}</Table.Td>
                                    <Table.Td style={{ fontSize: '0.9rem', color: '#868e96' }}>{item.memo || '-'}</Table.Td>
                                </Table.Tr>
                            ))
                        ) : (
                            <Table.Tr>
                                <Table.Td colSpan={4} ta="center" py="xl" c="dimmed">
                                    작업 이력이 없습니다.
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
             </ScrollArea>
        </Modal>
    );
}
