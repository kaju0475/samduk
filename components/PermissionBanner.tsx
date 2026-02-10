'use client';
import { Alert } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';

/**
 * Permission Banner Component
 * Displays a read-only mode notification for non-admin users
 */
export function ReadOnlyBanner() {
  return (
    <Alert
      icon={<IconLock size={16} />}
      title="읽기 전용 모드"
      color="yellow"
      styles={{
        root: {
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          marginBottom: '1rem',
          backgroundColor: 'rgba(250, 200, 0, 0.1)',
          border: '1px solid rgba(250, 200, 0, 0.3)',
        },
        title: {
          color: '#fab005',
          fontWeight: 600,
        },
        message: {
          color: 'rgba(255, 255, 255, 0.8)',
        },
      }}
    >
      현재 권한으로는 조회만 가능합니다. 수정이 필요하면 관리자에게 문의하세요.
    </Alert>
  );
}
