'use client';

import { createTheme, MantineColorsTuple } from '@mantine/core';

const premiumTitanium: MantineColorsTuple = [
  '#ebedef',
  '#c6c7cd',
  '#a3a5ac',
  '#80838d',
  '#5f6370',
  '#404454',
  '#25293b',
  '#151720', // Surface
  '#0b0c15', // Background
  '#000000'
];

const champagneGold: MantineColorsTuple = [
  '#fdfcf2',
  '#fbf8d9',
  '#f6efae',
  '#f0e57e',
  '#ebdc55',
  '#e6d43b', // Base Gold
  '#d4c22a',
  '#bfae1f',
  '#aa9915',
  '#94840b'
];

export const theme = createTheme({
  primaryColor: 'premiumTitanium',
  colors: {
    premiumTitanium: premiumTitanium,
    champagneGold: champagneGold,
  },
  fontFamily: 'Pretendard, Malgun Gothic, sans-serif',
  defaultRadius: 'md',
  components: {
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    }
  }
});
