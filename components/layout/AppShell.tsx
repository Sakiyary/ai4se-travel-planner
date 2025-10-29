"use client";

import { Box, Button, Flex, HStack, Spinner, Text, useToast } from '@chakra-ui/react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '../../lib/constants';
import { SidebarNav } from '../navigation/SidebarNav';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { supabaseClient } from '../../lib/supabaseClient';

const AUTH_ROUTES = new Set<string>([ROUTES.LOGIN]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { session, profile, isLoading } = useSupabaseAuth();
  const showChrome = pathname ? !AUTH_ROUTES.has(pathname) : true;

  if (!showChrome) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    if (!supabaseClient) {
      toast({ status: 'error', title: 'Supabase 未配置，无法登出。' });
      return;
    }

    try {
      await supabaseClient.auth.signOut();
      toast({ status: 'success', title: '已退出登录' });
    } catch (error) {
      const description = error instanceof Error ? error.message : undefined;
      toast({ status: 'error', title: '登出失败', description });
    }
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      <SidebarNav />
      <Box flex="1" p={{ base: 4, md: 8 }}>
        <Flex justify="flex-end" align="center" mb={6}>
          {isLoading ? (
            <HStack spacing={2} color="gray.500">
              <Spinner size="sm" />
              <Text fontSize="sm">正在检测登录状态...</Text>
            </HStack>
          ) : session ? (
            <HStack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                {profile?.email ?? session.user.email ?? '已登录用户'}
              </Text>
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                退出登录
              </Button>
            </HStack>
          ) : (
            <Button
              size="sm"
              colorScheme="cyan"
              variant="outline"
              onClick={() => {
                const loginRoute = '/login' as Route;
                router.push(loginRoute);
              }}
            >
              登录账号
            </Button>
          )}
        </Flex>
        {children}
      </Box>
    </Flex>
  );
}
