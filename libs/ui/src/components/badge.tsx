import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"
import { LuArmchair, LuCrown, LuSparkles } from "react-icons/lu"
import { IconType } from "react-icons"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}


export type BusClass = "vip" | "plus" | "standard";
interface ClassConfig {
  label: string;
  icon: IconType;
  classes: string;
  ring: string;
  iconBg: string;
}
const CLASS_CONFIG: Record<BusClass, ClassConfig> = {
  vip: {
    label: "VIP",
    icon: LuCrown,
    classes:
      "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 shadow-[0_0_0_1px_rgba(180,130,20,0.4),0_4px_14px_-2px_rgba(217,164,6,0.55)]",
    ring: "ring-1 ring-amber-200/60",
    iconBg: "bg-amber-950/10",
  },
  plus: {
    label: "Standard+",
    icon: LuSparkles,
    classes:
      "bg-gradient-to-r from-blue-500 to-sky-500 text-white moovi-shadow,0_4px_14px_-2px_rgba(16,185,129,0.45)]",
    ring: "ring-1 ring-blue-300/40",
    iconBg: "bg-white/15",
  },
  standard: {
    label: "Standard",
    icon: LuArmchair,
    classes: "bg-slate-100 text-slate-600 shadow-[0_0_0_1px_rgba(100,116,139,0.25)]",
    ring: "ring-1 ring-slate-200",
    iconBg: "bg-slate-500/10",
  },
};

interface ClassBadgeProps {
  variant: BusClass;
}
function ClassBadge({ variant }: ClassBadgeProps): React.JSX.Element {
  const config = CLASS_CONFIG[variant];
  const Icon = config.icon;
  const isPremium = variant !== "standard";
 
  return (
    <div
      className={`relative inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full select-none ${config.classes} ${config.ring}`}
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full ${config.iconBg}`}
      >
        <Icon
          className={`w-3 h-3 ${isPremium ? "" : "text-slate-500"}`}
          strokeWidth={2.5}
          fill={variant === "vip" ? "currentColor" : "none"}
        />
      </span>
      <span className="text-xs font-bold tracking-wide">{config.label}</span>
      {variant === "vip" && (
        <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <span className="absolute -inset-y-2 -left-8 w-6 rotate-12 bg-white/40 blur-sm animate-[shine_2.8s_ease-in-out_infinite]" />
        </span>
      )}
    </div>
  );
}


export { Badge, badgeVariants, ClassBadge }
