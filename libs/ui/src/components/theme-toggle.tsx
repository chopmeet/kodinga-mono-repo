import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

export type ThemeChoice = "light" | "dark" | "system"

type Labels = { toggle: string; light: string; dark: string; system: string }

const FRENCH: Labels = { toggle: "Changer de thème", light: "Clair", dark: "Sombre", system: "Système" }

/** Light, dark, or the one of the device (next-themes: class on <html>, kept in localStorage) */
export function ThemeToggle({ className, labels = FRENCH }: { className?: string; labels?: Labels }) {
  const { theme = "system", resolvedTheme, setTheme } = useTheme()
  const Icon = resolvedTheme === "dark" ? Moon : Sun
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: "light", label: labels.light, icon: Sun },
    { value: "dark", label: labels.dark, icon: Moon },
    { value: "system", label: labels.system, icon: Monitor },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("rounded-lg", className)} aria-label={labels.toggle} title={labels.toggle}>
          <Icon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setTheme(option.value)}>
            <option.icon />
            {option.label}
            {theme === option.value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ThemeProvider, useTheme } from "next-themes"
