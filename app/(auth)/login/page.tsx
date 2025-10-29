"use client";

import type { Route } from 'next';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '../../../lib/constants';
import { supabaseClient } from '../../../lib/supabaseClient';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, isLoading } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && session) {
      const dashboardRoute = '/dashboard' as Route;
      router.replace(dashboardRoute);
    }
  }, [isLoading, session, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabaseClient) {
      setError('Supabase 未配置，无法登录。请联系管理员。');
      return;
    }

    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }

    setIsSubmitting(true);

    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}${ROUTES.DASHBOARD}` : undefined;
      const { error: signInError } = await supabaseClient.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (signInError) {
        throw signInError;
      }

      setLinkSent(true);
      toast({ status: 'success', title: '邮件已发送', description: '请在邮箱中查收登录链接。' });
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : '登录请求失败，请稍后再试。';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Card w="100%" maxW="420px" shadow="lg" borderRadius="xl">
        <CardHeader textAlign="center">
          <Heading size="lg">登录 AI 旅行规划师</Heading>
          <Text mt={2} fontSize="sm" color="gray.600">
            使用邮箱获取一次性登录链接，登录后即可管理和保存旅行计划。
          </Text>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>邮箱地址</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </FormControl>

              <Button type="submit" colorScheme="cyan" isLoading={isSubmitting} loadingText="发送中">
                发送登录链接
              </Button>

              {linkSent ? (
                <Alert status="success" variant="left-accent">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    我们已向 {email} 发送登录链接，请在 5 分钟内完成验证。
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert status="error" variant="left-accent">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">{error}</AlertDescription>
                </Alert>
              ) : null}

              <Text fontSize="sm" color="gray.500" textAlign="center">
                仅想体验行程生成？可以直接访问 Planner 页面。
              </Text>

              <Button
                variant="outline"
                onClick={() => {
                  const plannerRoute = '/planner' as Route;
                  router.push(plannerRoute);
                }}
              >
                前往行程规划器
              </Button>
            </Stack>
          </form>
        </CardBody>
      </Card>
    </Box>
  );
}
