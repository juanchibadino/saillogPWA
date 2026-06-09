"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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
  contentId: string
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
  const contentId = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)

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

  React.useEffect(() => {
    if (!open) {
      return
    }

    function handleDocumentPointerDown(event: PointerEvent): void {
      const rootElement = rootRef.current

      if (!rootElement || !(event.target instanceof Node)) {
        return
      }

      if (!rootElement.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown)
    document.addEventListener("keydown", handleDocumentKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown)
      document.removeEventListener("keydown", handleDocumentKeyDown)
    }
  }, [open, setOpen])

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
        contentId,
      }}
    >
      <div ref={rootRef} className="relative">
        {input.children}
      </div>
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
    disabled,
    onClick,
    onKeyDown,
    ...buttonProps
  } = input
  const mask = grow
    ? undefined
    : "linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) calc(100% - 20px), rgba(255, 255, 255, 0) 100%)"

  return (
    <button
      type={type ?? "button"}
      aria-expanded={multiselect.open}
      aria-controls={multiselect.contentId}
      aria-haspopup="listbox"
      disabled={disabled}
      className={cn(
        "relative flex min-h-9 w-full items-center overflow-hidden rounded-lg border border-input bg-background text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event)

        if (!event.defaultPrevented) {
          multiselect.setOpen(!multiselect.open)
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)

        if (event.defaultPrevented) {
          return
        }

        if (event.key === "ArrowDown") {
          event.preventDefault()
          multiselect.setOpen(true)
        }
      }}
      {...buttonProps}
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
    </button>
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
  const label = typeof children === "string" ? children : value

  return (
    <Badge variant="secondary" className={cn("h-6 gap-1", className)} {...badgeProps}>
      {children}
      <span
        role="button"
        tabIndex={0}
        className="-mr-1 inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={(event) => {
          event.stopPropagation()
          multiselect.unselect(value)
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          multiselect.unselect(value)
        }}
        aria-label={`Unselect ${label}`}
      >
        <XIcon className="size-3" />
      </span>
    </Badge>
  )
}

export function MultiselectContent(
  input: React.ComponentPropsWithoutRef<"div"> & {
    align?: "start" | "center" | "end"
    sideOffset?: number
  },
) {
  const multiselect = useMultiselectContext()
  const { className, children, align, sideOffset, ...contentProps } = input
  void align
  void sideOffset

  if (!multiselect.open) {
    return null
  }

  return (
    <div
      id={multiselect.contentId}
      role="listbox"
      aria-multiselectable="true"
      className={cn(
        "mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className,
      )}
      {...contentProps}
    >
      {children}
    </div>
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
        onPointerDownCapture={(event) => {
          event.stopPropagation()
        }}
        onClickCapture={(event) => {
          event.stopPropagation()
        }}
        onKeyDownCapture={(event) => {
          event.stopPropagation()
        }}
        onKeyUpCapture={(event) => {
          event.stopPropagation()
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
        }}
        {...restInputProps}
      />
    </div>
  )
}

export function MultiselectItem(
  input: React.ComponentPropsWithoutRef<"button"> & {
    value: string
    onCheckedChange?: (checked: boolean) => void
  },
) {
  const multiselect = useMultiselectContext()
  const {
    className,
    value,
    children,
    disabled,
    type,
    onClick,
    onCheckedChange,
    ...itemProps
  } = input
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

  const isSelected = multiselect.selectionSet.has(value)

  return (
    <button
      type={type ?? "button"}
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      data-slot="multiselect-item"
      data-checked={isSelected ? "" : undefined}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        multiselect.toggle(value)
        onCheckedChange?.(!isSelected)
        onClick?.(event)
      }}
      {...itemProps}
    >
      <span
        className={cn(
          "pointer-events-none absolute right-2 flex items-center justify-center",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      >
        <CheckIcon className="size-4" />
      </span>
      {children}
    </button>
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
