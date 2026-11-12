"use client";
import type { MouseEvent } from "react";

import type { ReactTable } from "@tanstack/react-table";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataTableFeatures } from "@/lib/data-table-features";

import type { MemberRow } from "./data";

const LOADING_ROW_KEYS = [
  "loading-row-1",
  "loading-row-2",
  "loading-row-3",
  "loading-row-4",
  "loading-row-5",
  "loading-row-6",
  "loading-row-7",
  "loading-row-8",
  "loading-row-9",
  "loading-row-10",
  "loading-row-11",
  "loading-row-12",
  "loading-row-13",
  "loading-row-14",
  "loading-row-15",
  "loading-row-16",
  "loading-row-17",
  "loading-row-18",
  "loading-row-19",
  "loading-row-20",
  "loading-row-21",
  "loading-row-22",
  "loading-row-23",
  "loading-row-24",
  "loading-row-25",
  "loading-row-26",
  "loading-row-27",
  "loading-row-28",
  "loading-row-29",
  "loading-row-30",
  "loading-row-31",
  "loading-row-32",
  "loading-row-33",
  "loading-row-34",
  "loading-row-35",
  "loading-row-36",
  "loading-row-37",
  "loading-row-38",
  "loading-row-39",
  "loading-row-40",
  "loading-row-41",
  "loading-row-42",
  "loading-row-43",
  "loading-row-44",
  "loading-row-45",
  "loading-row-46",
  "loading-row-47",
  "loading-row-48",
  "loading-row-49",
  "loading-row-50",
];

function preventPaginationNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function getPageNumbers(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages: number[] = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(pageCount - 1, currentPage + 1);

  if (currentPage <= 3) {
    start = 2;
    end = 4;
  } else if (currentPage >= pageCount - 2) {
    start = pageCount - 3;
    end = pageCount - 1;
  }

  if (start > 2) {
    pages.push(-1); // represents left ellipsis
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < pageCount - 1) {
    pages.push(-2); // represents right ellipsis
  }

  pages.push(pageCount);
  return pages;
}

export function MembersTable({
  table,
  isLoading = false,
}: {
  table: ReactTable<DataTableFeatures, MemberRow>;
  isLoading?: boolean;
}) {
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(table.state.pagination.pageIndex + 1, pageCount);
  const pageNumbers = getPageNumbers(currentPage, pageCount);
  const rowsPerPage = `${table.state.pagination.pageSize}`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-normal">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading &&
              LOADING_ROW_KEYS.slice(0, table.state.pagination.pageSize || 10).map((rowKey) => (
                <TableRow key={rowKey} className="border-border/60">
                  <TableCell className="px-3 py-4">
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Skeleton className="size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading &&
              table.getRowModel().rows.length > 0 &&
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-white/2.5"
                  data-state={table.state.rowSelection[row.id] && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-4 align-middle">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={`${table.state.pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-20" id="members-rows-per-page">
                <SelectValue placeholder={rowsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span>
            Page {currentPage} of {pageCount}
          </span>
        </div>

        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event);
                  table.previousPage();
                }}
              />
            </PaginationItem>
            {pageNumbers.map((pageNumber) => {
              if (pageNumber === -1) {
                return (
                  <PaginationItem key="left-ellipsis">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              if (pageNumber === -2) {
                return (
                  <PaginationItem key="right-ellipsis">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return (
                <PaginationItem key={`page-${pageNumber}`}>
                  <PaginationLink
                    href="#"
                    isActive={table.state.pagination.pageIndex === pageNumber - 1}
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.setPageIndex(pageNumber - 1);
                    }}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href="#"
                text=""
                className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event);
                  table.nextPage();
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
