// components/admin/ResponsiveTable.tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  useMediaQuery,
  Box,
  Typography,
  Chip,
  IconButton,
  Card,
  CardContent,
  Stack
} from '@mui/material';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    // Mobile Card View
    return (
      <Box>
        {data.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
          data.map((row) => (
            <Card 
              key={row[keyField]} 
              sx={{ 
                mb: 2, 
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? { bgcolor: 'action.hover' } : {}
              }}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent>
                <Stack spacing={2}>
                  {columns
                    .filter(col => !col.hideOnMobile)
                    .map((column) => (
                      <Box key={column.id}>
                        <Typography variant="caption" color="text.secondary">
                          {column.label}
                        </Typography>
                        <Box>
                          {column.format ? column.format(row[column.id]) : row[column.id]}
                        </Box>
                      </Box>
                    ))}
                  
                  {actions && (
                    <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      {actions(row)}
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    );
  }

  // Desktop Table View
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                style={{ minWidth: column.minWidth }}
                sx={{ 
                  fontWeight: 700,
                  bgcolor: 'grey.50'
                }}
              >
                {column.label}
              </TableCell>
            ))}
            {actions && (
              <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>
                การดำเนินการ
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length + (actions ? 1 : 0)} 
                sx={{ textAlign: 'center', py: 4 }}
              >
                <Typography variant="body1" color="text.secondary">
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow 
                hover 
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                sx={{ 
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:last-child td, &:last-child th': { border: 0 }
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align}>
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell align="center">
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};