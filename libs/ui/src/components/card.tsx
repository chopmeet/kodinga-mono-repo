import * as React from "react"

import { cn } from "../lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}


export type CardType = {
    id: string,
    label: string,
    value?: number|string,
    color?: string,
    icon?: React.JSX.Element,
}

function OverviewCardItem ({item}: {item: CardType}) {
  return (
    <div className="overview__card moovi-shadow bg-white dark:bg-zinc-800 p-5 rounded-lg">
      <div className="flex items-center gap-4">
        {!!item?.icon &&
        <div 
          className="icon__wrapper p-2 rounded-lg"
          style={{ 
            color: item?.color, 
            backgroundColor: `${item?.color}1a` 
          }}
        >
          {item?.icon}
        </div> }
        <div className="value__and__label">
          <h6 className="value text-2xl font-semibold font-barlow">
            {item.value}
          </h6>
          <p className="m-0 label">
            {item.label}
          </p>
        </div>
      </div>
    </div>
  )
}


export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  OverviewCardItem,
}