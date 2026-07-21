// components/admin/ResponsiveTable.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any) => React.ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  keyField: string;
  onRowClick?: (row: any) => void;
  actions?: (row: any) => React.ReactNode;
  emptyMessage?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  data,
  keyField,
  onRowClick,
  actions,
  emptyMessage = 'ไม่มีข้อมูล'
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (isMobile) {
    return (
      <div>
        {data.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          data.map((row) => (
            <Card
              key={row[keyField]}
              className={cn('mb-4', onRowClick && 'cursor-pointer hover:bg-muted/50')}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent className="space-y-4 pt-6">
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((column) => (
                    <div key={column.id}>
                      <p className="text-xs text-muted-foreground">{column.label}</p>
                      <div>
                        {column.format ? column.format(row[column.id]) : row[column.id]}
                      </div>
                    </div>
                  ))}

                {actions && (
                  <div className="border-t pt-3">{actions(row)}</div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  'bg-muted/50 font-bold',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right'
                )}
                style={{ minWidth: column.minWidth }}
              >
                {column.label}
              </TableHead>
            ))}
            {actions && (
              <TableHead className="bg-muted/50 text-center font-bold">
                การดำเนินการ
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (actions ? 1 : 0)}
                className="py-8 text-center"
              >
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-center">{actions(row)}</TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
