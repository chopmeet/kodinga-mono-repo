import { MdOutlineInfo } from "react-icons/md";
import { IconType } from "react-icons";
import { cn } from "../lib/utils";

interface EmptyAlertProps {
    text?: string;
    icon?: IconType;
    className?: string;
}


export function EmptyAlert({
    text,
    icon: Icon = MdOutlineInfo,
    className,
}: EmptyAlertProps) {
    return (
        <div
            className={cn(
                "flex items-center w-full rounded-lg border border-border bg-primary/1 px-4 py-8",
                className
            )}
        >
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-border shrink-0">
                    <Icon className="w-9 h-9 text-soft" />
                </div>
                <p className="text-sm text-soft font-barlow font-semibold">
                    {text || "Pas de données"}
                </p>
            </div>
        </div>
    );
}