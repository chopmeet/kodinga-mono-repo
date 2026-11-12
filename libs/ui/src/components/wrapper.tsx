import { cn } from '../lib/utils'


function ColgateWrapper({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "wrapper p-3 bg-card rounded-xl",
        className
      )}
      {...props}
    >{children}</div>
  )
}

export {
  ColgateWrapper,
}