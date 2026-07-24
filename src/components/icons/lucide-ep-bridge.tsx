/**
 * Lucide → Element Plus (ep) icon bridge
 * ใช้ผ่าน alias `lucide-react` ใน tsconfig — ไม่ต้องแก้ import ทุกไฟล์
 *
 * สไตล์: outline / currentColor — โทนสีตามข้อความรอบข้าง ไม่ทาสีเต็ม
 */
'use client';

import React, { forwardRef, useMemo } from 'react';
import { Icon, addCollection } from '@iconify/react';
import epIcons from '@iconify-json/ep/icons.json';
import { cn } from '@/lib/utils';

addCollection(epIcons as any);

export type LucideProps = React.SVGProps<SVGSVGElement> & {
  size?: string | number;
  absoluteStrokeWidth?: boolean;
  strokeWidth?: string | number;
};

export type LucideIcon = React.ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
>;

type EpName = string;

/** เลือกเวอร์ชัน outline เป็นหลัก (เลี่ยง *-filled) */
const EP_BY_LUCIDE: Record<string, EpName> = {
  Activity: 'odometer',
  AlertCircle: 'warning',
  AlertTriangle: 'warning',
  ArrowLeft: 'arrow-left',
  ArrowUpRight: 'top-right',
  Badge: 'medal',
  BadgeCheck: 'circle-check',
  Ban: 'circle-close',
  BarChart2: 'histogram',
  BarChart3: 'data-analysis',
  Bell: 'bell',
  Calendar: 'calendar',
  CalendarCheck: 'calendar',
  CalendarCheck2: 'calendar',
  CalendarDays: 'calendar',
  CalendarX: 'calendar',
  Camera: 'camera',
  Car: 'van',
  Check: 'check',
  CheckCircle: 'circle-check',
  CheckCircle2: 'circle-check',
  CheckSquare: 'select',
  ChevronDown: 'arrow-down',
  ChevronLeft: 'arrow-left',
  ChevronRight: 'arrow-right',
  ChevronUp: 'arrow-up',
  Circle: 'semi-select',
  CircleAlert: 'warning',
  CircleCheck: 'circle-check',
  CircleUser: 'user',
  ClipboardCheck: 'document-checked',
  ClipboardList: 'tickets',
  ClipboardPenLine: 'edit-pen',
  Clock: 'clock',
  Clock3: 'clock',
  Copy: 'copy-document',
  Cpu: 'cpu',
  Crosshair: 'aim',
  Download: 'download',
  Edit: 'edit',
  ExternalLink: 'link',
  Eye: 'view',
  EyeOff: 'hide',
  FileStack: 'files',
  FileText: 'document',
  Filter: 'filter',
  FlaskConical: 'element-plus',
  Footprints: 'guide',
  Globe: 'place',
  GraduationCap: 'school',
  HelpCircle: 'help',
  History: 'clock',
  Home: 'house',
  Hourglass: 'timer',
  IdCard: 'postcard',
  Image: 'picture',
  ImageIcon: 'picture',
  ImageOff: 'picture',
  Info: 'info-filled',
  Layers: 'copy-document',
  LayoutDashboard: 'menu',
  LayoutGrid: 'grid',
  LayoutList: 'list',
  Link: 'link',
  Link2: 'connection',
  List: 'list',
  Loader2: 'loading',
  LocateFixed: 'aim',
  Lock: 'lock',
  LogIn: 'right',
  LogOut: 'switch-button',
  Mail: 'message',
  MailWarning: 'message-box',
  Map: 'map-location',
  MapPin: 'location',
  MapPinned: 'location',
  Maximize2: 'full-screen',
  Megaphone: 'promotion',
  Menu: 'operation',
  MessageSquareText: 'chat-line-square',
  Monitor: 'monitor',
  MonitorPlay: 'video-play',
  Moon: 'moon',
  MoreHorizontal: 'more',
  Move: 'rank',
  PanelLeft: 'fold',
  PanelLeftClose: 'expand',
  Paperclip: 'paperclip',
  Pencil: 'edit-pen',
  Phone: 'phone',
  PlayCircle: 'video-play',
  Plus: 'plus',
  QrCode: 'grid',
  Radar: 'compass',
  RefreshCw: 'refresh',
  RotateCcw: 'refresh-left',
  Rows3: 'list',
  Satellite: 'position',
  Save: 'folder-checked',
  ScanLine: 'crop',
  Search: 'search',
  Settings: 'setting',
  Settings2: 'set-up',
  Shield: 'stamp',
  ShieldAlert: 'warning',
  ShieldCheck: 'circle-check',
  Shuffle: 'sort',
  Smartphone: 'iphone',
  Sparkles: 'magic-stick',
  SquareArrowOutUpRight: 'top-right',
  Star: 'star',
  Sun: 'sunny',
  Tag: 'collection-tag',
  Trash: 'delete',
  Trash2: 'delete',
  TrendingUp: 'trend-charts',
  TriangleAlert: 'warning',
  Upload: 'upload',
  User: 'user',
  UserCheck: 'user',
  UserCircle: 'avatar',
  UserPlus: 'circle-plus',
  UserRound: 'user',
  UserX: 'remove',
  Users: 'user',
  X: 'close',
  XCircle: 'circle-close',
};

/** โทนเดียว — inherit สีจากข้อความ ไม่ทาสีทึบแยก */
const EP_TONE_CLASS = cn(
  'shrink-0',
  'text-current',
  '[&_path]:fill-current',
  '[&_path]:stroke-none',
  '[&_circle]:fill-current',
  '[&_rect]:fill-current',
  '[&_polygon]:fill-current'
);

function createEpIcon(epName: EpName, displayName: string): LucideIcon {
  const Comp = forwardRef<SVGSVGElement, LucideProps>(function EpLucideIcon(
    { className, size, style, color, ...rest },
    ref
  ) {
    const px = useMemo(() => {
      if (typeof size === 'number') return size;
      if (typeof size === 'string' && /^\d+$/.test(size)) return Number(size);
      return undefined;
    }, [size]);

    void rest;

    return (
      <Icon
        ref={ref as any}
        icon={`ep:${epName}` as any}
        className={cn(EP_TONE_CLASS, className)}
        width={px ?? '1em'}
        height={px ?? '1em'}
        color={typeof color === 'string' ? color : 'currentColor'}
        style={style}
        aria-hidden
      />
    );
  });
  Comp.displayName = displayName;
  return Comp;
}

const cache = new globalThis.Map<string, LucideIcon>();

function getIcon(lucideName: string): LucideIcon {
  const hit = cache.get(lucideName);
  if (hit) return hit;
  const ep = EP_BY_LUCIDE[lucideName] || 'help';
  const icon = createEpIcon(ep, lucideName);
  cache.set(lucideName, icon);
  return icon;
}

const icons = new Proxy({} as Record<string, LucideIcon>, {
  get(_t, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    if (prop === '__esModule') return true;
    if (prop === 'default') return icons;
    return getIcon(prop);
  },
  has(_t, prop) {
    return typeof prop === 'string';
  },
});

export default icons;

export const Activity = getIcon('Activity');
export const AlertCircle = getIcon('AlertCircle');
export const AlertTriangle = getIcon('AlertTriangle');
export const ArrowLeft = getIcon('ArrowLeft');
export const ArrowUpRight = getIcon('ArrowUpRight');
export const Badge = getIcon('Badge');
export const BadgeCheck = getIcon('BadgeCheck');
export const Ban = getIcon('Ban');
export const BarChart2 = getIcon('BarChart2');
export const BarChart3 = getIcon('BarChart3');
export const Bell = getIcon('Bell');
export const Calendar = getIcon('Calendar');
export const CalendarCheck = getIcon('CalendarCheck');
export const CalendarCheck2 = getIcon('CalendarCheck2');
export const CalendarDays = getIcon('CalendarDays');
export const CalendarX = getIcon('CalendarX');
export const Camera = getIcon('Camera');
export const Car = getIcon('Car');
export const Check = getIcon('Check');
export const CheckCircle = getIcon('CheckCircle');
export const CheckCircle2 = getIcon('CheckCircle2');
export const CheckSquare = getIcon('CheckSquare');
export const ChevronDown = getIcon('ChevronDown');
export const ChevronLeft = getIcon('ChevronLeft');
export const ChevronRight = getIcon('ChevronRight');
export const ChevronUp = getIcon('ChevronUp');
export const Circle = getIcon('Circle');
export const CircleAlert = getIcon('CircleAlert');
export const CircleCheck = getIcon('CircleCheck');
export const CircleUser = getIcon('CircleUser');
export const ClipboardCheck = getIcon('ClipboardCheck');
export const ClipboardList = getIcon('ClipboardList');
export const ClipboardPenLine = getIcon('ClipboardPenLine');
export const Clock = getIcon('Clock');
export const Clock3 = getIcon('Clock3');
export const Copy = getIcon('Copy');
export const Cpu = getIcon('Cpu');
export const Crosshair = getIcon('Crosshair');
export const Download = getIcon('Download');
export const Edit = getIcon('Edit');
export const ExternalLink = getIcon('ExternalLink');
export const Eye = getIcon('Eye');
export const EyeOff = getIcon('EyeOff');
export const FileStack = getIcon('FileStack');
export const FileText = getIcon('FileText');
export const Filter = getIcon('Filter');
export const FlaskConical = getIcon('FlaskConical');
export const Footprints = getIcon('Footprints');
export const Globe = getIcon('Globe');
export const GraduationCap = getIcon('GraduationCap');
export const HelpCircle = getIcon('HelpCircle');
export const History = getIcon('History');
export const Home = getIcon('Home');
export const Hourglass = getIcon('Hourglass');
export const IdCard = getIcon('IdCard');
export const Image = getIcon('Image');
export const ImageIcon = getIcon('ImageIcon');
export const ImageOff = getIcon('ImageOff');
export const Info = getIcon('Info');
export const Layers = getIcon('Layers');
export const LayoutDashboard = getIcon('LayoutDashboard');
export const LayoutGrid = getIcon('LayoutGrid');
export const LayoutList = getIcon('LayoutList');
export const Link = getIcon('Link');
export const Link2 = getIcon('Link2');
export const List = getIcon('List');
export const Loader2 = getIcon('Loader2');
export const LocateFixed = getIcon('LocateFixed');
export const Lock = getIcon('Lock');
export const LogIn = getIcon('LogIn');
export const LogOut = getIcon('LogOut');
export const Mail = getIcon('Mail');
export const MailWarning = getIcon('MailWarning');
export const Map = getIcon('Map');
export const MapPin = getIcon('MapPin');
export const MapPinned = getIcon('MapPinned');
export const Maximize2 = getIcon('Maximize2');
export const Megaphone = getIcon('Megaphone');
export const Menu = getIcon('Menu');
export const MessageSquareText = getIcon('MessageSquareText');
export const Monitor = getIcon('Monitor');
export const MonitorPlay = getIcon('MonitorPlay');
export const Moon = getIcon('Moon');
export const MoreHorizontal = getIcon('MoreHorizontal');
export const Move = getIcon('Move');
export const PanelLeft = getIcon('PanelLeft');
export const PanelLeftClose = getIcon('PanelLeftClose');
export const Paperclip = getIcon('Paperclip');
export const Pencil = getIcon('Pencil');
export const Phone = getIcon('Phone');
export const PlayCircle = getIcon('PlayCircle');
export const Plus = getIcon('Plus');
export const QrCode = getIcon('QrCode');
export const Radar = getIcon('Radar');
export const RefreshCw = getIcon('RefreshCw');
export const RotateCcw = getIcon('RotateCcw');
export const Rows3 = getIcon('Rows3');
export const Satellite = getIcon('Satellite');
export const Save = getIcon('Save');
export const ScanLine = getIcon('ScanLine');
export const Search = getIcon('Search');
export const Settings = getIcon('Settings');
export const Settings2 = getIcon('Settings2');
export const Shield = getIcon('Shield');
export const ShieldAlert = getIcon('ShieldAlert');
export const ShieldCheck = getIcon('ShieldCheck');
export const Shuffle = getIcon('Shuffle');
export const Smartphone = getIcon('Smartphone');
export const Sparkles = getIcon('Sparkles');
export const SquareArrowOutUpRight = getIcon('SquareArrowOutUpRight');
export const Star = getIcon('Star');
export const Sun = getIcon('Sun');
export const Tag = getIcon('Tag');
export const Trash = getIcon('Trash');
export const Trash2 = getIcon('Trash2');
export const TrendingUp = getIcon('TrendingUp');
export const TriangleAlert = getIcon('TriangleAlert');
export const Upload = getIcon('Upload');
export const User = getIcon('User');
export const UserCheck = getIcon('UserCheck');
export const UserCircle = getIcon('UserCircle');
export const UserPlus = getIcon('UserPlus');
export const UserRound = getIcon('UserRound');
export const UserX = getIcon('UserX');
export const Users = getIcon('Users');
export const X = getIcon('X');
export const XCircle = getIcon('XCircle');

/** ใช้สร้างไอคอน Ep โดยตรง: <EpIcon name="setting" /> */
export function EpIcon({
  name,
  className,
  size,
  color,
  style,
}: {
  name: string;
  className?: string;
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
}) {
  const px =
    typeof size === 'number'
      ? size
      : typeof size === 'string' && /^\d+$/.test(size)
        ? Number(size)
        : undefined;
  return (
    <Icon
      icon={`ep:${name}` as any}
      className={cn(EP_TONE_CLASS, className)}
      width={px ?? '1em'}
      height={px ?? '1em'}
      color={color || 'currentColor'}
      style={style}
      aria-hidden
    />
  );
}
