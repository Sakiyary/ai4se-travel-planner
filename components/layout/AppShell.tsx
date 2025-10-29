"use client";

import { Box, Flex } from '@chakra-ui/react';
import { usePathname } from 'next/navigation';
import { ROUTES } from '../../lib/constants';
import { SidebarNav } from '../navigation/SidebarNav';

const AUTH_ROUTES = new Set<string>([ROUTES.LOGIN]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showChrome = pathname ? !AUTH_ROUTES.has(pathname) : true;

  if (!showChrome) {
    return <>{children}</>;
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      <SidebarNav />
      <Box flex="1" p={{ base: 4, md: 8 }}>
        {children}
      </Box>
    </Flex>
  );
}
