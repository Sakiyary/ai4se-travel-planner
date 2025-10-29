"use client";

import type { Route } from 'next';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Spinner,
  Stack,
  Text
} from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { fetchPlans } from '../../lib/supabaseQueries';
import { getPlanDetailRoute } from '../../lib/constants';

export default function DashboardPage() {
  const router = useRouter();
  const { session, isLoading } = useSupabaseAuth();

  useEffect(() => {
    if (!isLoading && !session) {
      const loginRoute = '/login' as Route;
      router.replace(loginRoute);
    }
  }, [isLoading, session, router]);

  const {
    data: plans,
    isLoading: isPlansLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    enabled: Boolean(session),
    staleTime: 60_000
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof Error) {
      return error.message;
    }
    return '加载旅行计划时出现问题，请稍后重试。';
  }, [error]);

  if (isLoading || (!session && typeof window !== 'undefined')) {
    return (
      <Stack spacing={4} align="center" justify="center" minH="50vh">
        <Spinner size="lg" color="cyan.500" />
        <Text color="gray.600">正在加载你的旅行计划...</Text>
      </Stack>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Stack spacing={6}>
      <Heading size="lg">我的旅行计划</Heading>
      <Text color="gray.600">你保存的旅行计划会出现在这里，后续将提供预算与开销概览。</Text>

      {isError ? (
        <Alert status="error" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isPlansLoading ? (
        <Stack spacing={4} align="center" justify="center" minH="30vh">
          <Spinner size="lg" color="cyan.500" />
          <Text color="gray.600">正在获取旅行计划...</Text>
        </Stack>
      ) : plans && plans.length > 0 ? (
        <Stack spacing={4}>
          {plans.map((plan) => (
            <Card key={plan.id} variant="outline">
              <CardHeader>
                <Heading size="md">{plan.title}</Heading>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {formatPlanSubtitle(plan)}
                </Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={3} align="flex-start">
                  <Stack direction={{ base: 'column', sm: 'row' }} spacing={4} align="center">
                    <Text fontSize="sm" color="gray.600">
                      创建时间：{formatChineseDate(plan.created_at)}
                    </Text>
                    {typeof plan.budget === 'number' ? (
                      <Text fontSize="sm" color="gray.600">
                        预算：¥{plan.budget.toFixed(0)}
                      </Text>
                    ) : null}
                  </Stack>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Typed router currently expects Route literals; double cast keeps type safety elsewhere.
                      router.push(getPlanDetailRoute(plan.id) as unknown as Route);
                    }}
                  >
                    查看详情
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">还没有任何计划</Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={3}>
              <Text color="gray.600">
                目前还没有保存的行程。前往行程规划器生成一个新的旅行计划并保存，我们会在这里展示你的历史记录。
              </Text>
              <Button
                colorScheme="cyan"
                alignSelf="flex-start"
                onClick={() => {
                  const plannerRoute = '/planner' as Route;
                  router.push(plannerRoute);
                }}
              >
                前往行程规划器
              </Button>
              <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => refetch()}>
                重新加载
              </Button>
            </Stack>
          </CardBody>
        </Card>
      )}
    </Stack>
  );
}

function formatChineseDate(isoString: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function formatPlanSubtitle(plan: { destination: string | null }): string {
  if (plan.destination) {
    return plan.destination;
  }
  return '目的地待补充';
}
