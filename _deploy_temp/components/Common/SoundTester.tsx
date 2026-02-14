import { Button, Group, Paper, Text, Stack, Grid, Box } from '@mantine/core';
import { IconVolume } from '@tabler/icons-react';
import { useCallback } from 'react';

export function SoundTester() {

    const playTone = useCallback((type: number) => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        
        const playOscillator = (freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 0.5) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
            
            gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + duration);
        };

        // Sound Pack Library
        switch (type) {
            case 1: // Classic Success (Ding)
                playOscillator(880, 'sine', 0.1, 0, 0.5);
                playOscillator(1760, 'sine', 0.1, 0.1, 0.5);
                break;
            case 2: // Digital Success (Upward)
                playOscillator(440, 'square', 0.1, 0, 0.1);
                playOscillator(880, 'square', 0.1, 0.1, 0.1);
                break;
            case 3: // Warning (Low Buzz)
                playOscillator(150, 'sawtooth', 0.3, 0, 0.3);
                playOscillator(140, 'sawtooth', 0.3, 0.1, 0.3);
                break;
            case 4: // Error (Negative Beep)
                playOscillator(330, 'triangle', 0.2, 0, 0.6);
                playOscillator(280, 'triangle', 0.3, 0.1, 0.6);
                break;
            case 5: // Info (Soft Chime)
                playOscillator(523.25, 'sine', 0.5, 0, 0.4); // C5
                playOscillator(659.25, 'sine', 0.5, 0.1, 0.3); // E5
                break;
            case 6: // Retro Coin (Arcade)
                playOscillator(987, 'square', 0.1, 0, 0.1); // B5
                playOscillator(1318, 'square', 0.2, 0.1, 0.1); // E6
                break;
            case 7: // Sci-Fi Confirm (Laser)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
                break;
            case 8: // Deep Error (Thud)
                playOscillator(80, 'square', 0.2, 0, 0.6);
                break;
            case 9: // Gentle Alert (Fender Rhodes-ish)
                playOscillator(440, 'triangle', 0.4, 0, 0.4);
                playOscillator(444, 'sine', 0.4, 0, 0.3); // Detune
                break;
            case 10: // Urgent Notify (Double High)
                playOscillator(1200, 'sine', 0.1, 0, 0.5);
                playOscillator(1200, 'sine', 0.1, 0.15, 0.5);
                break;
        }

    }, []);

    return (
        <Paper withBorder p="md" mb="md" radius="md" bg="gray.1">
            <Stack gap="xs">
                <Group gap="xs">
                    <IconVolume size={20} />
                    <Text fw={700}>🔊 비프음 사운드 팩 테스트 (Sound Tester)</Text>
                </Group>
                <Text size="sm" c="dimmed">아래 버튼을 눌러 소리를 확인하고, 마음에 드는 번호를 알려주세요.</Text>
                
                <Grid>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Grid.Col span={2} key={i}>
                             <Button fullWidth variant="light" onClick={() => playTone(i)} color={i <= 2 ? 'teal' : i <= 4 ? 'red' : 'blue'}>
                                 소리 {i}
                             </Button>
                        </Grid.Col>
                    ))}
                    {[6, 7, 8, 9, 10].map(i => (
                        <Grid.Col span={2} key={i}>
                             <Button fullWidth variant="light" onClick={() => playTone(i)} color={i === 8 ? 'red' : 'gray'}>
                                 소리 {i}
                             </Button>
                        </Grid.Col>
                    ))}
                </Grid>
            </Stack>
        </Paper>
    );
}
