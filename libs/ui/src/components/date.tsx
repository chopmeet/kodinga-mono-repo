import { useState } from "react"
import { useTranslation } from "react-i18next"


type DateSelectorProps = {
    startDate?: Date
    daysCount?: number
    selectedDate?: Date
    onSelect?: (date: Date) => void
}

export default function DateDayFilter({
    startDate = new Date(),
    daysCount = 7,
    selectedDate: selectedDateProp,
    onSelect,
}: DateSelectorProps) {
    const { i18n } = useTranslation();

    const days = Array.from({ length: daysCount }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return date;
    });

    const [internalSelectedDate, setInternalSelectedDate] = useState(days[0]);
    const selectedDate = selectedDateProp ?? internalSelectedDate;

    const handleSelect = (date: Date) => {
        setInternalSelectedDate(date);
        onSelect?.(date);
    };

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const dayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: "short" });

    return (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide! pb-1">
            {days.map((date) => {
                const isActive = isSameDay(date, selectedDate);

                return (
                    <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => handleSelect(date)}
                        className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-3 min-w-19 transition-colors cursor-pointer font-barlow
                            ${isActive
                                ? "border-transparent bg-primary/80 shadow-sm"
                                : "border-border bg-card hover:border-border-strong"
                            }
                        `}
                    >
                        <span
                            className={`text-[11px] font-semibold tracking-wide uppercase
                                ${isActive ? "text-white" : "text-foreground"}
                            `}
                        >
                            {dayFormatter.format(date).replace(".", "")}.
                        </span>
                        <span
                            className={`text-3xl font-bold leading-none
                                ${isActive ? "text-white" : "text-foreground"}
                            `}
                        >
                            {date.getDate()}
                        </span>
                        <span
                            className={`text-xs
                                ${isActive ? "text-violet-200" : "text-faint"}
                            `}
                        >
                            {monthFormatter.format(date)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}