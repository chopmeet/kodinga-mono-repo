import React from "react";
import { cn } from "../lib/utils";

interface LoaderProps {
    /** Covers the whole screen (blurred backdrop) */
    fullscreen?: boolean;
    /**
     * In the flow of the page instead of over its parent: a page or a section loading
     * (`className` sets its height, e.g. "min-h-svh" or "py-16")
     */
    inline?: boolean;
    message?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeClasses: Record<NonNullable<LoaderProps["size"]>, { box: string; border: string }> = {
    sm: { box: "size-8", border: "border-2" },
    md: { box: "size-12", border: "border-4" },
    lg: { box: "size-16", border: "border-[5px]" },
};

export const Loader: React.FC<LoaderProps> = ({
    fullscreen = false,
    inline = false,
    message = "Chargement de la page...",
    size = "md",
    className,
}) => {
    const { box, border } = sizeClasses[size];

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "flex flex-col items-center justify-center transition-all duration-300",
                fullscreen
                    ? "fixed inset-0 z-9999 bg-slate-900/15 backdrop-blur"
                    : inline
                      ? "w-full py-16"
                      : "absolute inset-0 z-9999 bg-card/65 backdrop-blur-sm rounded-xl",
                className
            )}
        >
            {/* Container du spinner combinant la taille globale choisie */}
            <div className={cn("relative flex items-center justify-center", box)} aria-hidden>
                {/* Cercle de piste en arrière-plan */}
                <div className={cn("absolute inset-0 rounded-full box-border border-border-soft", border)} />
                {/* Cercle bleu animé en rotation */}
                <div
                    className={cn(
                        "absolute inset-0 rounded-full box-border border-transparent border-t-[#006dfb] border-l-[#006dfb] animate-spin",
                        border
                    )}
                />
            </div>

            {/* Message de chargement optionnel */}
            {message ? (
                <p className="mt-4 text-sm font-medium text-muted-foreground tracking-wide animate-pulse">
                    {message}
                </p>
            ) : (
                <span className="sr-only">Chargement…</span>
            )}
        </div>
    );
};
