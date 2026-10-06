import { FiCheckCircle, FiInfo } from "react-icons/fi";
import { AiOutlineWarning } from "react-icons/ai";
import { MdOutlineDangerous } from "react-icons/md";
import { ImSpinner3 } from "react-icons/im";
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"


const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <FiCheckCircle className="size-5" />,
        info: <FiInfo className="size-5" />,
        warning: <AiOutlineWarning className="size-5" />,
        error: <MdOutlineDangerous className="size-5" />,
        loading: <ImSpinner3 className="size-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group-[.toaster]:border",
          success: "group-[.toaster]:!bg-green-700 group-[.toaster]:!border-emerald-800 group-[.toaster]:!text-emerald-100",
          error:   "group-[.toaster]:!bg-red-600   group-[.toaster]:!border-red-800   group-[.toaster]:!text-red-100",
          info:    "group-[.toaster]:!bg-primary/20  group-[.toaster]:!border-blue-800  group-[.toaster]:!text-blue-100",
          warning: "group-[.toaster]:!bg-amber-600 group-[.toaster]:!border-amber-800 group-[.toaster]:!text-amber-100",
        }
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
