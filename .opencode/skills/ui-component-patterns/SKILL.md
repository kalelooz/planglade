---
name: ui-component-patterns
description: Use when creating or modifying UI components in FlowBoard. Provides patterns for shadcn/ui, Radix primitives, and product-grade component composition. Trigger keywords: component, UI, shadcn, Radix, dialog, dropdown, form, table, button.
---

# UI Component Patterns

## When to Use

Use this skill when:
- Creating new UI components
- Modifying existing component layouts
- Adding form controls or data displays
- Implementing dialogs, drawers, dropdowns, or popovers
- Building tables, lists, or data grids

## Core Principles

1. **Never hand-roll what shadcn provides** - Always check `@/components/ui/` first
2. **Compose, don't decorate** - Use Radix primitives for behavior, Tailwind for styling
3. **Product-grade, not demo-grade** - Dense, functional, calm surfaces
4. **Consistent patterns** - Match existing component structure and naming

## shadcn/ui Components Available

All components in `@/components/ui/`:
- `accordion`, `alert`, `alert-dialog`, `aspect-ratio`
- `avatar`, `badge`, `breadcrumb`, `button`
- `calendar`, `card`, `carousel`, `checkbox`
- `collapsible`, `command`, `context-menu`
- `dialog`, `drawer`, `dropdown-menu`
- `form`, `hover-card`, `input`, `input-otp`
- `label`, `menubar`, `navigation-menu`
- `pagination`, `popover`, `progress`, `radio-group`
- `resizable`, `scroll-area`, `select`, `separator`
- `sheet`, `sidebar`, `skeleton`, `slider`
- `sonner`, `switch`, `table`, `tabs`
- `textarea`, `toast`, `toggle`, `toggle-group`
- `tooltip`

## Common Component Patterns

### Dialog/Modal Pattern

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function MyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        {/* Content */}
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Form Pattern

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(2),
});

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Table Pattern (TanStack Table)

```tsx
"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({ data, columns }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Dropdown Menu Pattern

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

export function ActionsDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Styling Conventions

### Button Variants
- `default` - Primary action
- `destructive` - Delete/danger actions
- `outline` - Secondary actions, borders
- `secondary` - Tertiary actions
- `ghost` - Inline actions, hover-only
- `link` - Text-only navigation

### Spacing
- Use Tailwind spacing scale: `p-2`, `m-4`, `gap-3`
- Compact layouts: `p-2`, `gap-2` for dense interfaces
- Standard layouts: `p-4`, `gap-4` for breathing room

### Color Usage
- `bg-background` / `text-foreground` - Default surfaces
- `bg-primary` / `text-primary-foreground` - Primary actions
- `bg-muted` / `text-muted-foreground` - Secondary content
- `border-border` - Borders
- `ring-ring` - Focus rings

### Icon Usage
- Always from `lucide-react`
- Standard size: `h-4 w-4` for inline, `h-5 w-5` for standalone
- Use `className` for color: `className="text-muted-foreground"`

## Anti-Patterns to Avoid

- Hand-rolling dialogs, dropdowns, or popovers
- Creating custom design tokens when Tailwind variables exist
- Using decorative gradients or shadows for non-functional purposes
- Adding vanity metrics or fake demo data
- Creating unnecessary wrapper cards around simple content
- Using `div` with click handlers instead of `Button` components
- Inline styles instead of Tailwind classes
