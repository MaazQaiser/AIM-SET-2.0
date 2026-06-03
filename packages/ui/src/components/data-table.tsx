"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type Table as ReactTable,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./input";

interface DataTableColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  scrollable?: boolean;
  stickyHeader?: boolean;
  maxScrollHeight?: string;
  /** Wrap tbody in a clipping div when scrollable (valid overflow clip) */
  clipBody?: boolean;
  /** Optional classes for the bordered table shell (outer clip wrapper) */
  shellClassName?: string;
  /** Optional classes for the inner scroll wrapper when scrollable */
  scrollClassName?: string;
  /** Optional classes for the tbody clip wrapper when clipBody is enabled */
  bodyClipClassName?: string;
  /** Optional classes for the table element */
  tableClassName?: string;
  /** Optional classes for the thead element */
  headerClassName?: string;
  /** Optional classes for the tbody element */
  bodyClassName?: string;
  /** Optional classes for each body row */
  rowClassName?: string;
  /** Optional classes for the pagination row */
  paginationClassName?: string;
}

function DataTableHeader<TData>({
  table,
  scrollable,
  stickyHeader,
  headerClassName,
}: {
  table: ReactTable<TData>;
  scrollable: boolean;
  stickyHeader: boolean;
  headerClassName?: string;
}) {
  return (
    <thead
      className={cn(
        "border-b border-border bg-card",
        stickyHeader && "sticky top-0 z-10 bg-card",
        headerClassName
      )}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;

            return (
              <th
                key={header.id}
                className={cn(
                  "h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold text-muted-foreground",
                  scrollable && "relative z-0",
                  meta?.headerClassName
                )}
              >
                {header.isPlaceholder ? null : (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      header.column.getCanSort() && "cursor-pointer hover:text-foreground"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span className="text-muted-foreground/70">
                        {header.column.getIsSorted() === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </span>
                    )}
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}

function DataTableBody<TData>({
  table,
  columns,
  scrollable,
  bodyClassName,
  rowClassName,
}: {
  table: ReactTable<TData>;
  columns: ColumnDef<TData, unknown>[];
  scrollable: boolean;
  bodyClassName?: string;
  rowClassName?: string;
}) {
  return (
    <tbody className={cn("bg-card", bodyClassName)}>
      {table.getRowModel().rows.length ? (
        table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className={cn(
              "group border-b border-border/70 bg-card last:border-0 transition-colors hover:bg-muted/20",
              rowClassName
            )}
          >
            {row.getVisibleCells().map((cell) => {
              const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;

              return (
                <td
                  key={cell.id}
                  className={cn(
                    "px-4 py-2.5 align-middle text-sm text-foreground",
                    scrollable && "relative z-0",
                    meta?.cellClassName
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        ))
      ) : (
        <tr className={cn("bg-card", rowClassName)}>
          <td
            colSpan={columns.length}
            className={cn("h-24 bg-card text-center text-muted-foreground", bodyClassName)}
          >
            No results.
          </td>
        </tr>
      )}
    </tbody>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize = 10,
  scrollable = false,
  stickyHeader = false,
  maxScrollHeight = "max-h-[calc(100vh-16rem)]",
  clipBody = false,
  shellClassName,
  scrollClassName,
  bodyClipClassName,
  tableClassName,
  headerClassName,
  bodyClassName,
  rowClassName,
  paginationClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize } },
  });

  const tableClasses = cn(
    "w-full border-collapse bg-card text-sm",
    scrollable && "min-w-max",
    tableClassName
  );

  const useBodyClip = scrollable && clipBody;

  const header = (
    <DataTableHeader
      table={table}
      scrollable={scrollable}
      stickyHeader={stickyHeader}
      headerClassName={headerClassName}
    />
  );

  const body = (
    <DataTableBody
      table={table}
      columns={columns as ColumnDef<TData, unknown>[]}
      scrollable={scrollable}
      bodyClassName={bodyClassName}
      rowClassName={rowClassName}
    />
  );

  const tableContent = useBodyClip ? (
    <div className="min-w-max">
      <table className={tableClasses}>{header}</table>
      <div className={cn("box-border overflow-hidden", bodyClipClassName)}>
        <table className={tableClasses}>{body}</table>
      </div>
    </div>
  ) : (
    <table className={tableClasses}>
      {header}
      {body}
    </table>
  );

  return (
    <div className="space-y-4">
      {searchKey && (
        <Input
          placeholder={searchPlaceholder}
          value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
      )}

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card",
          shellClassName
        )}
      >
        <div
          className={cn(
            scrollable ? cn("overflow-auto", maxScrollHeight) : undefined,
            scrollClassName
          )}
        >
          {tableContent}
        </div>
      </div>

      <div className={cn("flex items-center justify-between", paginationClassName)}>
        <p className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
