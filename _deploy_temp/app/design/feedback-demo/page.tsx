
'use client';

import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';
import { Button, Container, Group, Text, Title, Paper } from '@mantine/core';

export default function Page() {
    const trigger = useVisualFeedbackStore((state) => state.trigger);

    return (
        <Container size="sm" py={50}>
            <Title order={1} mb="xl" ta="center">모바일 시각 피드백 테스트</Title>
            <Text ta="center" mb={50} c="dimmed">
                각 버튼을 클릭하여 화면 테두리의 알림 효과를 확인하세요.
                <br />
                (실제 모바일 환경에서는 화면 전체가 깜빡입니다)
            </Text>

            <Group grow styles={{ root: { flexDirection: 'column' } }}>
                <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={700} mb="md">1. 정상 처리 (Success)</Text>
                    <Text size="sm" c="dimmed" mb="md">초록색 / 0.5초 / 납품 완료, 입고 완료 등</Text>
                    <Button 
                        color="green" 
                        size="xl" 
                        fullWidth 
                        onClick={() => trigger('success')}
                    >
                        정상 알림 테스트
                    </Button>
                </Paper>

                <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={700} mb="md">2. 주의/경고 (Warning)</Text>
                    <Text size="sm" c="dimmed" mb="md">**노랑색 (Amber)** / 1.0초 / 재고 부족, 검사 임박 등</Text>
                    <Button 
                        color="#FFC107" 
                        size="xl" 
                        fullWidth 
                        onClick={() => trigger('warning')}
                        style={{ color: '#000' }} // Dark text for contrast on yellow
                    >
                        주의 알림 테스트
                    </Button>
                </Paper>

                <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={700} mb="md">3. 위험/에러 (Error)</Text>
                    <Text size="sm" c="dimmed" mb="md">빨강색 / 1.5초 / 타사 용기 혼입, 폐기 대상 등</Text>
                    <Button 
                        color="red" 
                        size="xl" 
                        fullWidth 
                        onClick={() => trigger('error')}
                    >
                        위험 알림 테스트
                    </Button>
                </Paper>
            </Group>
        </Container>
    );
}
