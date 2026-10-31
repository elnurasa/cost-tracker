import {
  Archive, ArrowLeftRight, Baby, Banknote, Bike, BookOpen, Briefcase, Bus, CalendarClock, Car, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleCheck, CirclePlus, CloudOff, Coffee, Delete, Download, Droplets, Ellipsis, Eye, EyeOff, Fingerprint, Fuel, Gamepad2, Gift,
  GraduationCap, HandCoins, HeartPulse, House, Info, Landmark, Languages, Lock, Minus, Moon, Music, Palette, PawPrint, Pencil, Pill, PiggyBank,
  Plane, Plus, Receipt, RotateCcw, Search, Settings, Shield, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sparkles,
  SlidersHorizontal, Sun, Tag, Trash2, TrendingUp, Upload, Utensils, Wallet, Wifi, Wrench, X, Zap, Database, Layers, History, Repeat, FileText,
  CalendarDays, CircleHelp, Umbrella, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  house: House, receipt: Receipt, 'shopping-basket': ShoppingBasket, bus: Bus, gift: Gift, sparkles: Sparkles, 'hand-coins': HandCoins,
  'piggy-bank': PiggyBank, shield: Shield, 'calendar-clock': CalendarClock, wallet: Wallet, utensils: Utensils, coffee: Coffee, car: Car,
  'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap, shirt: Shirt, baby: Baby, 'paw-print': PawPrint, plane: Plane, 'gamepad-2': Gamepad2,
  music: Music, 'book-open': BookOpen, wrench: Wrench, smartphone: Smartphone, wifi: Wifi, zap: Zap, droplets: Droplets, briefcase: Briefcase,
  banknote: Banknote, landmark: Landmark, tag: Tag, 'shopping-bag': ShoppingBag, pill: Pill, bike: Bike, fuel: Fuel, umbrella: Umbrella,
  // UI glyphs
  check: Check, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft, 'chevron-down': ChevronDown, x: X, plus: Plus, minus: Minus, search: Search,
  settings: Settings, info: Info, 'cloud-off': CloudOff, delete: Delete, trash: Trash2, pencil: Pencil, 'circle-check': CircleCheck,
  'trending-up': TrendingUp, 'circle-plus': CirclePlus, lock: Lock, 'shield-check': ShieldCheck, download: Download, upload: Upload, moon: Moon,
  sun: Sun, 'arrow-left-right': ArrowLeftRight, eye: Eye, 'eye-off': EyeOff, fingerprint: Fingerprint, filter: SlidersHorizontal, 'rotate-ccw': RotateCcw,
  archive: Archive, history: History, ellipsis: Ellipsis, languages: Languages, palette: Palette, database: Database, layers: Layers, repeat: Repeat,
  'file-text': FileText, 'calendar-days': CalendarDays, help: CircleHelp,
};
export const ENVELOPE_ICONS = [
  'house', 'receipt', 'shopping-basket', 'utensils', 'coffee', 'bus', 'car', 'fuel', 'bike', 'gift', 'sparkles', 'gamepad-2', 'music', 'book-open',
  'graduation-cap', 'shirt', 'baby', 'paw-print', 'plane', 'heart-pulse', 'pill', 'smartphone', 'wifi', 'zap', 'droplets', 'wrench', 'briefcase',
  'banknote', 'landmark', 'tag', 'shopping-bag', 'wallet', 'piggy-bank', 'hand-coins', 'calendar-clock', 'shield', 'umbrella', 'repeat',
];

export function Icon({ name, size = 24, className, mirror }: { name: string; size?: number; className?: string; mirror?: boolean }) {
  const C = MAP[name] ?? Wallet;
  return <C size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" className={`icon${mirror ? ' mirror' : ''}${className ? ` ${className}` : ''}`} />;
}
