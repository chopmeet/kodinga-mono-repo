import { MdOutlineLuggage, MdRestaurant, MdWifi } from "react-icons/md";
import { BiBulb, BiUsb } from "react-icons/bi";
import { FaBath, FaSnowflake } from "react-icons/fa";
import { FiMonitor } from "react-icons/fi";
import { IconType } from "react-icons";


export const iconMap: Record<string, IconType> = {
  MdWifi:          MdWifi,
  BiUsb:           BiUsb,
  MdRestaurant:    MdRestaurant,
  FaSnowflake:     FaSnowflake,
  FaBath:          FaBath,
  FiMonitor:       FiMonitor,
  BiBulb:          BiBulb,
  MdOutlineLuggage: MdOutlineLuggage,
};

interface DynamicIconProps {
  name?: string | null;
  className?: string;
  size?: number;
}

export function DynamicIcon({ name, className, size = 20 }: DynamicIconProps) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon className={className} size={size} />;
}