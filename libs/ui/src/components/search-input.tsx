import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight, Search, X } from "lucide-react"
import { cn } from "cn"

const searchInputVariants = cva(
  "w-full border border-slate-200 bg-white text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-brand focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden",
  {
    variants: {
      size: {
        sm: "h-9 rounded-full pr-9 pl-9 text-sm focus:ring-3",
        lg: "h-14 rounded-full pr-12 pl-14 text-base shadow-lg shadow-slate-900/5 focus:ring-4 sm:h-[4.5rem] sm:text-lg",
      },
    },
    defaultVariants: { size: "sm" },
  }
)

type SearchInputProps = Omit<React.ComponentProps<"input">, "size" | "onChange" | "value"> &
  VariantProps<typeof searchInputVariants> & {
    value: string
    onValueChange: (value: string) => void
    /** Accessible name (visually hidden) */
    label: string
    clearLabel?: string
    /** Renders a round submit button on the right (e.g. to jump to the results) */
    onSubmit?: () => void
    submitLabel?: string
  }

/** Search field with leading icon and a clear button. Brand color comes from the app theme. */
function SearchInput({
  id,
  value,
  onValueChange,
  label,
  clearLabel = "Clear search",
  onSubmit,
  submitLabel = "Search",
  size,
  onKeyDown,
  className,
  ...props
}: SearchInputProps) {
  const fallbackId = React.useId()
  const inputId = id ?? fallbackId
  const large = size === "lg"

  return (
    <div data-slot="search-input" className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400",
          large ? "left-5 size-5" : "left-3 size-4"
        )}
      />
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.()
          onKeyDown?.(e)
        }}
        className={cn(searchInputVariants({ size }), onSubmit && (large ? "pr-28 sm:pr-32" : "pr-16"))}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label={clearLabel}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700",
            onSubmit ? (large ? "right-16 sm:right-20" : "right-10") : large ? "right-4" : "right-2"
          )}
        >
          <X className={large ? "size-4" : "size-3.5"} />
        </button>
      )}
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          aria-label={submitLabel}
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-colors hover:bg-brand-hover",
            large ? "right-2 size-10 sm:right-3 sm:size-12" : "right-1 size-7"
          )}
        >
          <ArrowRight className={large ? "size-5" : "size-4"} />
        </button>
      )}
    </div>
  )
}

export { SearchInput, searchInputVariants }
