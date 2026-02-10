'use client';

import { Modal, Switch, Stack, Text, Button, Group } from '@mantine/core';
import { IconVolume, IconDeviceMobile } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getSoundSettings, saveSoundSettings, type SoundSettings } from '@/app/utils/soundSettings';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface SoundSettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function SoundSettingsModal({ opened, onClose }: SoundSettingsModalProps) {
  const handleClose = useModalBackTrap(opened, onClose, 'sound-settings-modal');
  const [settings, setSettings] = useState<SoundSettings>({
    soundEnabled: true,
    vibrationEnabled: true,
  });

  useEffect(() => {
    if (opened) {
      setTimeout(() => {
        setSettings(getSoundSettings());
      }, 0);
    }
  }, [opened]);

  const handleSoundToggle = (checked: boolean) => {
    const updated = { ...settings, soundEnabled: checked };
    setSettings(updated);
    saveSoundSettings(updated);
  };

  const handleVibrationToggle = (checked: boolean) => {
    const updated = { ...settings, vibrationEnabled: checked };
    setSettings(updated);
    saveSoundSettings(updated);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="알림 설정"
      centered
      size="sm"
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <Group gap="xs">
            <IconVolume size={24} />
            <Text>알림음</Text>
          </Group>
          <Switch
            checked={settings.soundEnabled}
            onChange={(event) => handleSoundToggle(event.currentTarget.checked)}
            size="md"
          />
        </Group>

        <Group justify="space-between">
          <Group gap="xs">
            <IconDeviceMobile size={24} />
            <Text>진동</Text>
          </Group>
          <Switch
            checked={settings.vibrationEnabled}
            onChange={(event) => handleVibrationToggle(event.currentTarget.checked)}
            size="md"
          />
        </Group>

        <Button onClick={onClose} fullWidth>
          확인
        </Button>
      </Stack>
    </Modal>
  );
}
