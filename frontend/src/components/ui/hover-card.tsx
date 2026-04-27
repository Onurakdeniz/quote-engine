"use client"

import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    setContainer(document.body)
  }, [])

  if (!container) return null

  return createPortal(
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "hover-card-ultra-glass w-64 rounded-2xl p-4 text-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 duration-300",
        className
      )}
      style={{ 
        zIndex: 2147483647, 
        position: 'fixed',
        isolation: 'isolate',
        transform: 'translateZ(0)',
        willChange: 'transform',
        ...props.style 
      }}
      {...props}
    />,
    container
  )
})
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent } 