import React from 'react';
import { Box, Text } from 'ink';

interface BorderProps {
  label?: string;
  color: string;
  width: number | string;
  height: number | string;
  children: React.ReactNode;
}

export function Border({ label, color, width, height, children }: BorderProps) {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={color}
      overflow="hidden"
    >
      {label && (
        <Box marginLeft={1}>
          <Text color={color} bold> {label} </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
