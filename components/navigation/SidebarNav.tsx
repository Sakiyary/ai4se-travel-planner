"use client";

import { Box, Icon, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Compass, HandCoins, Home, User } from 'lucide-react';
import { ROUTES } from '../../lib/constants';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: '总览', href: ROUTES.DASHBOARD, icon: Home },
  { label: '行程规划', href: ROUTES.PLANNER, icon: Compass },
  { label: '预算与支出', href: ROUTES.EXPENSES, icon: HandCoins },
  { label: '个人资料', href: ROUTES.PROFILE, icon: User }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <Box as="nav" width="250px" p={4} display={{ base: 'none', md: 'block' }}>
      <Stack spacing={2}>
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              as={NextLink}
              href={item.href}
              rounded="md"
              px={3}
              py={2}
              display="flex"
              alignItems="center"
              gap={3}
              bg={isActive ? 'brand.50' : 'transparent'}
              color={isActive ? 'brand.600' : 'gray.600'}
              _hover={{ textDecoration: 'none', bg: 'brand.50', color: 'brand.700' }}
              transition="all 0.2s"
            >
              <Icon as={item.icon} boxSize={5} />
              <Text fontWeight={isActive ? 'bold' : 'medium'}>{item.label}</Text>
            </Link>
          );
        })}
      </Stack>
    </Box>
  );
}
