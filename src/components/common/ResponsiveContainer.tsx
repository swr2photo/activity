import React from 'react';
import Container from '@mui/material/Container';
import type { ContainerProps } from '@mui/material/Container';

export type ResponsiveContainerProps = ContainerProps;

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = (props) => {
  return <Container {...props} />;
};
