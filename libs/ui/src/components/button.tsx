import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"
import { NavLink } from "react-router-dom"
import { MdBlock, MdMail, MdOutlineAddBox, MdPrint, MdSend } from "react-icons/md"
import { FaArrowLeft, FaArrowRight, FaCheck, FaEye, FaTrash } from "react-icons/fa"
import { FiArchive, FiDownload, FiEdit } from "react-icons/fi"
import { LuChevronDown, LuChevronLeft, LuChevronRight, LuScanLine, LuUpload } from "react-icons/lu"
import { Spinner } from "./spinner"
import { CiSearch } from "react-icons/ci"


const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Same look as the buttons of the home page (header, hero, creator callout)
        default: "bg-blue-900 text-white shadow-sm hover:bg-blue-950",
        danger:
          "bg-destructive/10 text-destructive border hover:border-destructive/60 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 dark:hover:bg-destructive/30",
        outline:
          "border border-border bg-card text-body shadow-2xs hover:border-border-strong hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 px-8 text-[15px] has-[>svg]:px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


const icones = {
  add: MdOutlineAddBox,
  edit: FiEdit,
  eye: FaEye,
  download: FiDownload,
  upload: LuUpload,
  delete: FaTrash,
  suspend: MdBlock,
  arrowLeft: FaArrowLeft,
  arrowRight: FaArrowRight,
  check: FaCheck,
  message: MdMail,
  chevronDown: LuChevronDown,
  chevronRight: LuChevronRight,
  chevronLeft: LuChevronLeft,
  print: MdPrint,
  scan: LuScanLine,
  archive: FiArchive,
  search: CiSearch,
  send: MdSend
} as const

type IconName = keyof typeof icones

function Button({
  className,
  variant,
  size,
  asChild = false,
  icon,
  iconPosition = "left",
  isLink,
  link,
  isLoading,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean,
    icon?: IconName,
    iconPosition?: "left" | "right",
    isLink?: boolean,
    link?: string,
    isLoading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const IconItem = icon ? icones[icon] : null

  if (isLink === true) {
    return (
      <NavLink
        className={cn(buttonVariants({ variant, size }), className)}
        to={link || ""}
      >
        {IconItem && iconPosition === "left" && <IconItem />}
        {children}
        {IconItem && iconPosition === "right" && <IconItem />}
      </NavLink>
    )
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {IconItem && iconPosition === 'left' && <IconItem />}
      {isLoading && <Spinner />}
      {/* With asChild, Slot needs exactly one element to merge into (e.g. a <Link>):
          Slottable marks it, the icons/spinner are rendered inside that element */}
      <Slottable>{isLoading && !asChild ? "En cours..." : children}</Slottable>
      {IconItem && iconPosition === 'right' && <IconItem />}
    </Comp>
  )
}


export { Button, buttonVariants }
