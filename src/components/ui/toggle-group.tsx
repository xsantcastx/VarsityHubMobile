"use client"

import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const ToggleGroupContext = React.createContext({
  size: "default",
  variant: "default",
  value: null,
  onValueChange: () => {},
  type: 'single',
})

const ToggleGroup = React.forwardRef(({
  className,
  variant,
  size,
  children,
  value,
  onValueChange,
  type = 'single',
  ...props
}, ref) => (
  <div
    ref={ref}
    role="group"
    className={cn("inline-flex items-center justify-center gap-1 rounded-md", className)}
    {...props}>
    <ToggleGroupContext.Provider value={{ variant, size, value, onValueChange, type }}>
      {children}
    </ToggleGroupContext.Provider>
  </div>
))

ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef(({
  className,
  children,
  value,
  variant,
  size,
  ...props
}, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const isSelected = context.type === 'single' ? context.value === value : context.value?.includes(value);

  const handlePress = () => {
    if (context.onValueChange) {
        context.onValueChange(value);
    }
  }

  return (
    <button
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      data-state={isSelected ? 'on' : 'off'}
      onClick={handlePress}
      {...props}>
      {children}
    </button>
  )
})

ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }