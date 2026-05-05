"use client"

import * as React from "react"
import { ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

type MultiselectContextValue = {
  selection: string[]
  selectionSet: Set<string>
  toggle: (value: string) => void
  unselect: (value: string) => void
  open: boolean
  setOpen: (value: boolean) => void
  query: string
  setQuery: (value: string) => void
  registerItem: (value: string, label: string) => void
  unregisterItem: (value: string) => void
  hasMatchingItems: boolean
}

const MultiselectContext = React.createContext<MultiselectContextValue | null>(null)

function useMultiselectContext(): MultiselectContextValue {
  const value = React.useContext(MultiselectContext)

  if (!value) {
    throw new Error("Multiselect components must be used inside <Multiselect>.")
  }

  return value
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function matchesQuery(input: {
  query: string
  value: string
  label: string
}): boolean {
  const normalizedQuery = normalizeSearchValue(input.query)

  if (normalizedQuery.length === 0) {
    return true
  }

  return (
    input.value.toLowerCase().includes(normalizedQuery) ||
    input.label.toLowerCase().includes(normalizedQuery)
  )
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map((item) => extractText(item)).join(" ")
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children)
  }

  return ""
}

function useControllableArrayState(input: {
  value?: string[]
  defaultValue: string[]
  onChange?: (value: string[]) => void
}): [string[], (nextValue: string[] | ((previousValue: string[]) => string[])) => void] {
  const isControlled = typeof input.value !== "undefined"
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string[]>(input.defaultValue)
  const value = React.useMemo(
    () => (isControlled ? input.value ?? [] : uncontrolledValue),
    [input.value, isControlled, uncontrolledValue],
  )
  const valueRef = React.useRef(value)

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  const setValue = React.useCallback(
    (nextValue: string[] | ((previousValue: string[]) => string[])) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? nextValue(valueRef.current)
          : nextValue

      if (!isControlled) {
        setUncontrolledValue(resolvedValue)
      }

      input.onChange?.(resolvedValue)
    },
    [input, isControlled],
  )

  return [value, setValue]
}

function useControllableBooleanState(input: {
  value?: boolean
  defaultValue: boolean
  onChange?: (value: boolean) => void
}): [boolean, (nextValue: boolean) => void] {
  const isControlled = typeof input.value !== "undefined"
  const [uncontrolledValue, setUncontrolledValue] = React.useState<boolean>(input.defaultValue)
  const value = isControlled ? input.value ?? false : uncontrolledValue

  const setValue = React.useCallback(
    (nextValue: boolean) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue)
      }

      input.onChange?.(nextValue)
    },
    [input, isControlled],
  )

  return [value, setValue]
}

export function Multiselect(input: {
  value?: string[]
  onValueChange?: (value: string[]) => void
  defaultValue?: string[]
  open?: boolean
  onOpenChange?: (value: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [selection, setSelection] = useControllableArrayState({
    value: input.value,
    defaultValue: input.defaultValue ?? [],
    onChange: input.onValueChange,
  })
  const [open, setOpen] = useControllableBooleanState({
    value: input.open,
    defaultValue: input.defaultOpen ?? false,
    onChange: input.onOpenChange,
  })
  const [query, setQuery] = React.useState("")
  const [itemsByValue, setItemsByValue] = React.useState<Record<string, string>>({})

  const selectionSet = React.useMemo(() => new Set(selection), [selection])

  const toggle = React.useCallback(
    (value: string) => {
      setSelection((previousValue) => {
        if (previousValue.includes(value)) {
          return previousValue.filter((item) => item !== value)
        }

        return [...previousValue, value]
      })
    },
    [setSelection],
  )

  const unselect = React.useCallback(
    (value: string) => {
      setSelection((previousValue) => previousValue.filter((item) => item !== value))
    },
    [setSelection],
  )

  const registerItem = React.useCallback((value: string, label: string) => {
    setItemsByValue((previousValue) => {
      if (previousValue[value] === label) {
        return previousValue
      }

      return {
        ...previousValue,
        [value]: label,
      }
    })
  }, [])

  const unregisterItem = React.useCallback((value: string) => {
    setItemsByValue((previousValue) => {
      if (!(value in previousValue)) {
        return previousValue
      }

      const nextValue = { ...previousValue }
      delete nextValue[value]
      return nextValue
    })
  }, [])

  const hasMatchingItems = React.useMemo(() => {
    const entries = Object.entries(itemsByValue)

    if (entries.length === 0) {
      return false
    }

    return entries.some(([value, label]) =>
      matchesQuery({
        query,
        value,
        label,
      }),
    )
  }, [itemsByValue, query])

  React.useEffect(() => {
    if (open) {
      setQuery("")
    }
  }, [open])

  return (
    <MultiselectContext.Provider
      value={{
        selection,
        selectionSet,
        toggle,
        unselect,
        open,
        setOpen,
        query,
        setQuery,
        registerItem,
        unregisterItem,
        hasMatchingItems,
      }}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        {input.children}
      </DropdownMenu>
    </MultiselectContext.Provider>
  )
}

export function MultiselectTrigger(
  input: React.ComponentPropsWithoutRef<"button"> & {
    placeholder?: string
    grow?: boolean
  },
) {
  const multiselect = useMultiselectContext()
  const {
    className,
    children,
    placeholder = "Select...",
    grow = false,
    type,
    ...buttonProps
  } = input
  const mask = grow
    ? undefined
    : "linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) calc(100% - 20px), rgba(255, 255, 255, 0) 100%)"

  return (
    <DropdownMenuTrigger
      render={
        <button
          type={type ?? "button"}
          className={cn(
            "relative flex min-h-9 w-full items-center overflow-hidden rounded-lg border border-input bg-background text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...buttonProps}
        />
      }
    >
      <div
        className="min-w-0 flex-1 overflow-x-auto px-2 py-1.5"
        style={{
          mask,
          WebkitMask: mask,
        }}
      >
        {multiselect.selection.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          children
        )}
      </div>
      <div className="pr-2 text-muted-foreground">
        <ChevronsUpDownIcon className="size-4" />
      </div>
    </DropdownMenuTrigger>
  )
}

export function MultiselectBadgeList(
  input: React.ComponentPropsWithoutRef<"div">,
) {
  return (
    <div className={cn("flex flex-wrap gap-1", input.className)} {...input} />
  )
}

export function MultiselectBadge(
  input: React.ComponentPropsWithoutRef<typeof Badge> & {
    value: string
  },
) {
  const multiselect = useMultiselectContext()
  const { className, children, value, ...badgeProps } = input

  return (
    <Badge variant="secondary" className={cn("h-6 gap-1", className)} {...badgeProps}>
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="-mr-1 shadow-none"
        onClick={(event) => {
          event.stopPropagation()
          multiselect.unselect(value)
        }}
        aria-label={`Unselect ${typeof children === "string" ? children : value}`}
      >
        <XIcon className="size-3" />
      </Button>
    </Badge>
  )
}

export function MultiselectContent(
  input: React.ComponentPropsWithoutRef<typeof DropdownMenuContent>,
) {
  const { className, children, ...contentProps } = input

  return (
    <DropdownMenuContent
      className={cn("max-h-72 w-[var(--anchor-width)] overflow-y-auto p-1", className)}
      align="start"
      sideOffset={6}
      {...contentProps}
    >
      {children}
    </DropdownMenuContent>
  )
}

export function MultiselectInput(
  input: Omit<React.ComponentPropsWithoutRef<typeof Input>, "value" | "onChange">,
) {
  const multiselect = useMultiselectContext()
  const { className, placeholder = "Search...", ...restInputProps } = input

  return (
    <div className="mb-1">
      <Input
        value={multiselect.query}
        onChange={(event) => multiselect.setQuery(event.target.value)}
        placeholder={placeholder}
        className={cn("h-8", className)}
        onKeyDown={(event) => {
          event.stopPropagation()
        }}
        {...restInputProps}
      />
    </div>
  )
}

export function MultiselectItem(
  input: Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuCheckboxItem>, "checked"> & {
    value: string
  },
) {
  const multiselect = useMultiselectContext()
  const { className, value, children, onCheckedChange, ...itemProps } = input
  const registerItem = multiselect.registerItem
  const unregisterItem = multiselect.unregisterItem
  const label = React.useMemo(() => {
    const extracted = extractText(children).trim()
    return extracted.length > 0 ? extracted : value
  }, [children, value])

  React.useEffect(() => {
    registerItem(value, label)

    return () => {
      unregisterItem(value)
    }
  }, [label, registerItem, unregisterItem, value])

  const isVisible = matchesQuery({
    query: multiselect.query,
    value,
    label,
  })

  if (!isVisible) {
    return null
  }

  const checked = multiselect.selectionSet.has(value)

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      closeOnClick={false}
      onCheckedChange={(nextChecked, eventDetails) => {
        const shouldSelect = Boolean(nextChecked)

        if (shouldSelect && !checked) {
          multiselect.toggle(value)
        }

        if (!shouldSelect && checked) {
          multiselect.toggle(value)
        }

        onCheckedChange?.(nextChecked, eventDetails)
      }}
      className={cn("pr-2", className)}
      {...itemProps}
    >
      {children}
    </DropdownMenuCheckboxItem>
  )
}

export function MultiselectEmpty(input: React.ComponentPropsWithoutRef<"p">) {
  const multiselect = useMultiselectContext()

  if (multiselect.hasMatchingItems) {
    return null
  }

  return (
    <p className={cn("px-2 py-1.5 text-sm text-muted-foreground", input.className)}>
      {input.children}
    </p>
  )
}
