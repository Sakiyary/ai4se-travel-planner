"use client";

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Heading,
  Select,
  Spinner,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  useToast
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ExpenseForm } from '../../components/expenses/ExpenseForm';
import { ExpenseList } from '../../components/expenses/ExpenseList';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  fetchPlans,
  type ExpenseRecord,
  type PlanRecord
} from '../../lib/supabaseQueries';
import { ROUTES } from '../../lib/constants';

export default function ExpensesPage() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !session) {
      const loginRoute = ROUTES.LOGIN as Route;
      toast({ status: 'info', title: '请先登录', description: '登录后即可管理预算与支出。' });
      router.replace(loginRoute);
    }
  }, [isAuthLoading, session, router, toast]);

  const {
    data: plans,
    isLoading: isPlansLoading,
    isError: isPlansError,
    error: plansError
  } = useQuery<PlanRecord[]>({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    enabled: Boolean(session),
    staleTime: 60_000
  });

  useEffect(() => {
    if (!plans || plans.length === 0) {
      setSelectedPlanId(null);
      return;
    }

    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const {
    data: expenses,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
    error: expensesError
  } = useQuery<ExpenseRecord[]>({
    queryKey: ['expenses', selectedPlanId],
    queryFn: () => fetchExpenses(selectedPlanId as string),
    enabled: Boolean(session && selectedPlanId),
    staleTime: 30_000
  });

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });

  const selectedPlan = useMemo(() => plans?.find((plan) => plan.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  const totalSpent = useMemo(() => {
    if (!expenses) {
      return 0;
    }
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const remainingBudget = useMemo(() => {
    if (!selectedPlan || typeof selectedPlan.budget !== 'number') {
      return null;
    }
    return selectedPlan.budget - totalSpent;
  }, [selectedPlan, totalSpent]);

  if (isAuthLoading || (!session && typeof window !== 'undefined')) {
    return (
      <Stack spacing={4} align="center" justify="center" minH="50vh">
        <Spinner size="lg" color="cyan.500" />
        <Text color="gray.600">正在加载登录状态...</Text>
      </Stack>
    );
  }

  if (!session) {
    return null;
  }

  if (isPlansLoading) {
    return (
      <Stack spacing={4} align="center" justify="center" minH="50vh">
        <Spinner size="lg" color="cyan.500" />
        <Text color="gray.600">正在获取旅行计划...</Text>
      </Stack>
    );
  }

  if (isPlansError) {
    const description = plansError instanceof Error ? plansError.message : '加载计划失败，请稍后再试。';
    return (
      <Alert status="error" variant="left-accent">
        <AlertIcon />
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card variant="outline">
        <CardHeader>
          <Heading size="md">还没有旅行计划</Heading>
        </CardHeader>
        <CardBody>
          <Stack spacing={3}>
            <Text color="gray.600">请先使用行程规划器生成并保存旅行计划后，再记录费用。</Text>
            <Button colorScheme="cyan" alignSelf="flex-start" onClick={() => router.push(ROUTES.PLANNER as Route)}>
              前往行程规划器
            </Button>
          </Stack>
        </CardBody>
      </Card>
    );
  }

  const expensesErrorMessage =
    expensesError instanceof Error ? expensesError.message : '加载费用记录失败，请稍后再试。';

  async function handleCreateExpense(values: {
    amount: number;
    currency: string;
    category: string | null;
    method: string | null;
    notes: string | null;
    timestamp: string;
  }) {
    if (!selectedPlanId) {
      throw new Error('请选择一个旅行计划。');
    }

    let isoTimestamp: string | undefined;
    if (values.timestamp) {
      const parsed = new Date(values.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        isoTimestamp = parsed.toISOString();
      }
    }

    await createExpenseMutation.mutateAsync({
      planId: selectedPlanId,
      amount: values.amount,
      currency: values.currency,
      category: values.category,
      method: values.method,
      notes: values.notes,
      timestamp: isoTimestamp
    });
  }

  async function handleDeleteExpense(expenseId: string) {
    if (deleteExpenseMutation.isPending) {
      return;
    }
    setDeletingExpenseId(expenseId);
    try {
      await deleteExpenseMutation.mutateAsync(expenseId);
      toast({ status: 'success', title: '已删除费用记录' });
    } catch (error) {
      const description = error instanceof Error ? error.message : '删除费用记录失败，请稍后再试。';
      toast({ status: 'error', title: '删除失败', description });
    } finally {
      setDeletingExpenseId(null);
    }
  }

  return (
    <Stack spacing={6} pb={10} maxW="6xl">
      <Heading size="lg">费用预算与管理</Heading>
      <Text color="gray.600">选择旅行计划后，可记录和查看实际开销，后续将支持语音记账与图表分析。</Text>

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">选择旅行计划</Heading>
        </CardHeader>
        <CardBody>
          <Select value={selectedPlanId ?? ''} onChange={(event) => setSelectedPlanId(event.target.value || null)} maxW="360px">
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.title}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {selectedPlan ? (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">预算概览</Heading>
          </CardHeader>
          <CardBody>
            <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="stretch">
              <Stat>
                <StatLabel>总预算</StatLabel>
                <StatNumber>{formatCurrency(selectedPlan.budget ?? null, selectedPlan.currency)}</StatNumber>
                <StatHelpText>来自 AI 行程规划结果</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>已记录开销</StatLabel>
                <StatNumber>{formatCurrency(totalSpent, selectedPlan.currency)}</StatNumber>
                <StatHelpText>合计 {expenses?.length ?? 0} 笔</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>剩余预算</StatLabel>
                <StatNumber>
                  {remainingBudget === null ? '—' : formatCurrency(remainingBudget, selectedPlan.currency)}
                </StatNumber>
                <StatHelpText>实时计算</StatHelpText>
              </Stat>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">记录新开销</Heading>
        </CardHeader>
        <CardBody>
          <ExpenseForm
            defaultCurrency={selectedPlan?.currency ?? 'CNY'}
            onSubmit={handleCreateExpense}
            isSubmitting={createExpenseMutation.isPending}
          />
        </CardBody>
      </Card>

      <Divider />

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">已记录的费用</Heading>
        </CardHeader>
        <CardBody>
          {isExpensesError ? (
            <Alert status="error" variant="left-accent">
              <AlertIcon />
              <AlertDescription>{expensesErrorMessage}</AlertDescription>
            </Alert>
          ) : isExpensesLoading ? (
            <Stack spacing={4} align="center" justify="center" minH="200px">
              <Spinner size="lg" color="cyan.500" />
              <Text color="gray.600">正在加载费用记录...</Text>
            </Stack>
          ) : (
            <ExpenseList
              expenses={expenses ?? []}
              currency={selectedPlan?.currency}
              onDelete={handleDeleteExpense}
              deletingId={deletingExpenseId}
            />
          )}
        </CardBody>
      </Card>
    </Stack>
  );
}

function formatCurrency(amount: number | null, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '未设置';
  }

  const currencyCode = currency ?? 'CNY';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currencyCode}`;
  }
}
