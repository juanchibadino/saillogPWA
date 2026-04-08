import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TableSkeletonProps = {
  columns: number;
  rows?: number;
};

export function TableSkeleton({ columns, rows = 6 }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
          {Array.from({ length: columns }).map((_, index) => (
            <TableHead key={`head-${index}`}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={`row-${rowIndex}`}>
            {Array.from({ length: columns }).map((__, colIndex) => (
              <TableCell key={`cell-${rowIndex}-${colIndex}`}>
                <Skeleton
                  className={colIndex === 0 ? "h-4 w-16" : "h-4 w-full max-w-[12rem]"}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
