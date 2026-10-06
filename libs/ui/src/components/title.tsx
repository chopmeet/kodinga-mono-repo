import { cn } from "../lib/utils"
import { JSX } from "react"

function TopTitle({
    title,
    paragraph,
    wrapperClassName,
    className,
}: {
    title: string,
    paragraph?: string,
    wrapperClassName?: string,
    className?: string,
}) {
    return (
        <div className={`mb-4 title__wrapper ${wrapperClassName}`}>
            <h2
                title={title}
                className={cn(
                    "pb-2 text-2xl font-barlow font-bold",
                    className
                )}
            >{title}</h2>
            <p className="line-clamp-1">
            {paragraph}
            </p>
        </div>
    )
}

function MediumTitle({
    title,
    className,
}: {
    title: string,
    className?: string,
}) {
    return (
        <div className="mb-3 title__wrapper">
            <h4 
                title={title}
                className={cn(
                    "text-lg lg:text-xl text-zinc-600 dark:text-foreground font-medium",
                    className
                )}
            >{title}</h4>
        </div>
    )
}

function TitleWithIcon({
    title,
    icon,
    className,
}: {
    title: string,
    icon: JSX.Element,
    className?: string,
}) {
    return (
        <h4 
            title={title}
            className={cn("text-lg font-medium mb-3 flex items-center gap-2",
                className
            )}
        >
            <span className="text-primary">{icon}</span>
            {title}
        </h4>
    )
}


export { 
    TopTitle,
    MediumTitle,
    TitleWithIcon,
}
