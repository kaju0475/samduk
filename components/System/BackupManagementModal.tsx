
import { useState, useEffect } from 'react';
import { Modal, Tabs, Button, Table, Group, Card, Text, LoadingOverlay } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { IconClock, IconFolder, IconDatabaseImport, IconSettings, IconRefresh, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface BackupManagementModalProps {
    opened: boolean;
    onClose: () => void;
}

interface BackupFile {
    name: string;
    size: number;
    created: string;
}

export function BackupManagementModal({ opened, onClose }: BackupManagementModalProps) {
    const handleClose = useModalBackTrap(opened, onClose, 'backup-management');
    const [activeTab, setActiveTab] = useState<string | null>('settings');
    const [loading, setLoading] = useState(false);

    // Config State
    const [backupTime, setBackupTime] = useState<string>('00:00'); // HH:mm
    const [backupPath, setBackupPath] = useState<string>('backups');
    
    // List State
    const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
    const [backupLoading, setBackupLoading] = useState(false);

    // Load Config
    useEffect(() => {
        if (opened && activeTab === 'settings') {
            fetchConfig();
        }
        if (opened && activeTab === 'restore') {
            fetchFiles();
        }
    }, [opened, activeTab]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system/backup/config');
            const json = await res.json();
            if (json.success && json.data) {
                // [Fix] Ensure fallback to empty string or default to prevent undefined (controlled input error)
                setBackupPath(json.data.backupPath || 'backups');
                // Convert Cron to Time
                // Cron: Minute Hour * * *
                const parts = json.data.backupSchedule.split(' ');
                if (parts.length >= 2) {
                    const min = parts[0].padStart(2, '0');
                    let hour = parts[1];
                    // Handle 'Every Hour' (*) as '00' for UI display
                    if (hour === '*') hour = '00';
                    else hour = hour.padStart(2, '0');
                    
                    setBackupTime(`${hour}:${min}`);
                }
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '설정을 불러오지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system/backup/files');
            const json = await res.json();
            if (json.success) {
                setBackupFiles(json.data);
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '백업 목록을 불러오지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            // Convert Time to Cron
            const [hour, min] = backupTime.split(':');
            // Basic validation
            if (!hour || !min) throw new Error("시간 형식이 올바르지 않습니다.");
            
            // Cron: min hour * * *
            const cronSchedule = `${parseInt(min)} ${parseInt(hour)} * * *`;

            const res = await fetch('/api/system/backup/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    backupSchedule: cronSchedule,
                    backupPath: backupPath.trim() || 'backups'
                })
            });
            const json = await res.json();
            if (json.success) {
                notifications.show({ title: '저장 완료', message: '백업 설정이 변경되었습니다.', color: 'green' });
            } else {
                throw new Error(json.message);
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '실패', message: '설정 저장에 실패했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    // 수동 백업 실행
    const handleBackupNow = async () => {
        setBackupLoading(true);
        try {
            const res = await fetch('/api/system/backup/now', {
                method: 'POST'
            });
            const json = await res.json();
            if (json.success) {
                notifications.show({ 
                    title: '백업 완료', 
                    message: `백업 파일이 생성되었습니다: ${json.filename}`, 
                    color: 'green' 
                });
                // Refresh file list if on restore tab
                if (activeTab === 'restore') {
                    fetchFiles();
                }
            } else {
                throw new Error(json.message || '백업 실패');
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '실패', message: '백업 생성에 실패했습니다.', color: 'red' });
        } finally {
            setBackupLoading(false);
        }
    };

    const handleRestore = async (filename: string) => {
        if (!confirm(`정말로 복구하시겠습니까?\n대상 파일: ${filename}\n현재 데이터가 덮어씌워집니다.`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/system/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            const json = await res.json();
            if (json.success) {
                notifications.show({ title: '복구 완료', message: '데이터가 복구되었습니다. 새로고침합니다.', color: 'green' });
                // Optional: Reload page
                setTimeout(() => window.location.reload(), 2000);
            } else {
                throw new Error(json.message);
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '실패', message: '복구에 실패했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };


    // Helper for file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <Modal 
            opened={opened} 
            onClose={handleClose}
            title={<Text fw={700} size="lg">백업 관리 (Backup Management)</Text>} 
            size="xl"
            centered
        >
            <LoadingOverlay visible={loading} />
            
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="settings" leftSection={<IconSettings size={18} />}>설정 변경</Tabs.Tab>
                    <Tabs.Tab value="restore" leftSection={<IconDatabaseImport size={18} />}>백업 불러오기</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="settings" pt="md">
                    <Card withBorder shadow="sm" radius="md" mb="md">
                        <Group mb="xs">
                            <IconClock color="gray" />
                            <Text fw={600}>백업 시점 변경</Text>
                        </Group>
                        <Text c="dimmed" size="sm" mb="md">매일 자동으로 백업할 시간을 설정합니다.</Text>
                        
                        <Group align="flex-end" gap="md">
                            <TimeInput 
                                label="매일 실행 시간"
                                value={backupTime}
                                onChange={(e) => setBackupTime(e.currentTarget.value)}
                                style={{ flex: 1 }}
                            />
                            <Button 
                                leftSection={<IconDeviceFloppy size={16} />} 
                                variant="light"
                                color="blue"
                                onClick={handleBackupNow}
                                loading={backupLoading}
                                size="sm"
                            >
                                지금 백업
                            </Button>
                        </Group>
                        
                        <Text c="dimmed" size="xs" mt="xs">
                            * 버튼을 클릭하면 현재 데이터를 즉시 백업합니다.
                        </Text>
                    </Card>

                    <Card withBorder shadow="sm" radius="md" mb="md">
                        <Group justify="space-between" mb="xs">
                            <Group gap={5}>
                                <IconFolder size={20} />
                                <Text fw={500}>백업 폴더</Text>
                            </Group>
                            <Text size="xs" c="dimmed">백업 파일이 저장되는 PC 경로입니다. (변경 불가)</Text>
                        </Group>
                        <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>C:\Users\new\Desktop\삼덕용기\samduk-system\backups</Text>
                    </Card>

                    <Group justify="flex-end" mt="xl">
                        <Button leftSection={<IconDeviceFloppy size={18}/>} onClick={handleSaveConfig} color="blue">
                            설정 저장
                        </Button>
                    </Group>
                </Tabs.Panel>

                <Tabs.Panel value="restore" pt="md">
                     <Group justify="space-between" mb="sm">
                        <Text size="sm" c="dimmed">최근 30일간의 백업 파일 목록입니다.</Text>
                        <Button variant="light" size="xs" leftSection={<IconRefresh size={14}/>} onClick={fetchFiles}>새로고침</Button>
                    </Group>

                    <Card withBorder p={0} mb="md" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {backupFiles.length === 0 ? (
                            <Text ta="center" c="dimmed" py="xl">저장된 백업 파일이 없습니다.</Text>
                        ) : (
                            <Table striped highlightOnHover style={{ tableLayout: 'auto' }}>
                                <Table.Thead style={{ position: 'sticky', top: 0, background: 'var(--mantine-color-body)' }}>
                                    <Table.Tr>
                                        <Table.Th style={{ paddingLeft: '4px', paddingRight: '4px' }}>파일명</Table.Th>
                                        <Table.Th visibleFrom="sm">생성 일시</Table.Th>
                                        <Table.Th style={{ paddingLeft: 0, paddingRight: '16px' }}>크기</Table.Th>
                                        <Table.Th visibleFrom="sm" style={{ textAlign: 'center' }}>작업</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {backupFiles.map((file) => (
                                        <Table.Tr key={file.name}>
                                            <Table.Td style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                                                <div style={{ fontWeight: 500 }}>{file.name}</div>
                                                {/* Mobile Only Date Display: 2nd line */}
                                                <div className="mantine-hidden-from-sm">
                                                    <Text size="xs" c="dimmed">
                                                        {new Date(file.created).toLocaleDateString()} {new Date(file.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </div>
                                            </Table.Td>
                                            
                                            {/* PC Only Date Display */}
                                            <Table.Td visibleFrom="sm" style={{ whiteSpace: 'nowrap' }}>
                                                {new Date(file.created).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Table.Td>
                                            
                                            <Table.Td style={{ paddingLeft: 0, paddingRight: '16px' }}>
                                                <div style={{ whiteSpace: 'nowrap' }}>{formatSize(file.size)}</div>
                                                {/* Mobile Only: Restore Button under Size */}
                                                <div className="mantine-hidden-from-sm" style={{ marginTop: '4px' }}>
                                                     <Button 
                                                        variant="subtle" 
                                                        color="red" 
                                                        size="compact-xs" 
                                                        leftSection={<IconDatabaseImport size={12}/>}
                                                        onClick={() => handleRestore(file.name)}
                                                        style={{ paddingLeft: 0, paddingRight: '4px' }}
                                                    >
                                                        복구
                                                    </Button>
                                                </div>
                                            </Table.Td>

                                            <Table.Td visibleFrom="sm" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <Button 
                                                    variant="subtle" 
                                                    color="red" 
                                                    size="xs" 
                                                    leftSection={<IconDatabaseImport size={14}/>}
                                                    onClick={() => handleRestore(file.name)}
                                                >
                                                    복구
                                                </Button>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Card>

                    {/* Path Search Bar Removed as per request */}
                </Tabs.Panel>
            </Tabs>
        </Modal>
    );
}
