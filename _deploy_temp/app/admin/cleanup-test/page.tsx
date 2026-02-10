'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Container, Title, Text, Card, Alert } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

export default function CleanupTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tx: number; cyl: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    if (!confirm('정말로 테스트 데이터(SIMULATOR_BOT, TEST-SIM)를 삭제하시겠습니까?')) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🧹 Cleanup starting...');

      // 1. Delete Transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .delete()
        .or('workerId.ilike.SIMULATOR_BOT,workerId.ilike.%SIMULATOR%')
        .select();

      if (txError) throw txError;

      // 2. Delete Cylinders
      const { data: cylData, error: cylError } = await supabase
        .from('cylinders')
        .delete()
        .or('id.ilike.TEST-SIM%,serial_number.ilike.TEST-SIM%,id.ilike.%SIMULATOR%')
        .select();

      if (cylError) throw cylError;

      setResult({
        tx: txData?.length || 0,
        cyl: cylData?.length || 0,
      });

    } catch (err) {
      console.error('Cleanup failed:', err);
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Title order={2} mb="md">테스트 데이터 긴급 청소</Title>
        <Text c="dimmed" mb="xl">
          자동화 스크립트 권한 문제로 인해, 관리자님의 브라우저 권한을 사용하여 
          직접 데이터를 삭제해야 합니다. 아래 버튼을 눌러주세요.
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="오류 발생" color="red" mb="lg">
            {error}
          </Alert>
        )}

        {result && (
          <Alert icon={<IconCheck size={16} />} title="청소 완료!" color="green" mb="lg">
            <Text>삭제된 트랜잭션: {result.tx}건</Text>
            <Text>삭제된 용기: {result.cyl}건</Text>
          </Alert>
        )}

        <Button 
          onClick={handleCleanup} 
          loading={loading} 
          color="red" 
          fullWidth 
          size="lg"
        >
          SIMULATOR_BOT 데이터 삭제하기
        </Button>
      </Card>
    </Container>
  );
}
