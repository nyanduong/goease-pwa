import {
  CompassIcon,
  MapTrifoldIcon,
  StampIcon,
  UserIcon,
} from '@phosphor-icons/react';

export const travelerSections = [
  { path: '/', label: 'Khám phá', icon: CompassIcon },
  { path: '/di-choi', label: 'Đi chơi', icon: MapTrifoldIcon },
  { path: '/dau-an', label: 'Dấu ấn', icon: StampIcon },
  { path: '/toi', label: 'Tôi', icon: UserIcon },
] as const;
