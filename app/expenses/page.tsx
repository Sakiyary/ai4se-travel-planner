"use client";

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Heading,
  Progress,
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
import {
  ExpenseQuickAddModal,
  type ExpenseQuickAddDefaults
} from '../../components/expenses/ExpenseQuickAddModal';
import { VoiceUpload } from '../../components/planner/VoiceUpload';
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
import { parseExpenseFromTranscript } from '../../lib/voiceExpenseParser';

type DailyBreakdownItem = {
  date: string;
  amount: number;
  isUnknown: boolean;
};

export default function ExpensesPage() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceDefaults, setVoiceDefaults] = useState<ExpenseQuickAddDefaults | null>(null);
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState('');

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

  const remainingRatio = useMemo(() => {
    if (remainingBudget === null) {
      return null;
    }

    if (!selectedPlan || typeof selectedPlan.budget !== 'number' || selectedPlan.budget <= 0) {
      return null;
    }

    return remainingBudget / selectedPlan.budget;
  }, [remainingBudget, selectedPlan]);

  const categoryBreakdown = useMemo(() => {
    if (!expenses || expenses.length === 0) {
      return [] as Array<{ category: string; amount: number }>;
    }

    const map = new Map<string, number>();
    expenses.forEach((expense) => {
      const key = expense.category && expense.category.trim() ? expense.category.trim() : '其他';
      map.set(key, (map.get(key) ?? 0) + expense.amount);
    });

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const dailyBreakdown = useMemo<DailyBreakdownItem[]>(() => {
    if (!expenses || expenses.length === 0) {
      return [];
    }

    const map = new Map<string, number>();

    expenses.forEach((expense) => {
      const dateSource = expense.timestamp ?? expense.created_at;
      const parsed = new Date(dateSource);
      const key = Number.isNaN(parsed.getTime())
        ? '未知日期'
        : parsed.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + expense.amount);
    });

    return Array.from(map.entries())
      .map(([date, amount]) => ({ date, amount, isUnknown: date === '未知日期' }))
      .sort((a, b) => {
        if (a.isUnknown && !b.isUnknown) {
          return 1;
        }
        if (!a.isUnknown && b.isUnknown) {
          return -1;
        }
        return a.date.localeCompare(b.date);
      });
  }, [expenses]);

  const maxCategoryAmount = useMemo(() => {
    if (categoryBreakdown.length === 0) {
      return 1;
    }
    return Math.max(...categoryBreakdown.map((item) => item.amount), 1);
  }, [categoryBreakdown]);

  useEffect(() => {
    if (!selectedPlanId) {
      setIsVoiceModalOpen(false);
      setVoiceDefaults(null);
      setLastVoiceTranscript('');
    }
  }, [selectedPlanId]);

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

  function ensurePlanSelected(): boolean {
    if (!selectedPlanId) {
      toast({ status: 'warning', title: '请先选择旅行计划，再使用语音记账。' });
      return false;
    }
    return true;
  }

  async function handleVoiceAudioProcessed(payload: {
    blob: Blob;
    transcript: string;
    durationMs?: number | null;
    source: 'upload' | 'recording';
  }) {
    if (!ensurePlanSelected()) {
      return;
    }

    const transcript = payload.transcript.trim();
    if (!transcript) {
      toast({ status: 'warning', title: '语音转写为空', description: '请重新录制或上传更清晰的语音。' });
      return;
    }

    const parsed = parseExpenseFromTranscript(transcript);
    setVoiceDefaults({
      amount: parsed.amount,
      currency: parsed.currency || selectedPlan?.currency || 'CNY',
      category: parsed.category,
      method: parsed.method,
      notes: parsed.notes
    });
    setLastVoiceTranscript(parsed.notes ?? transcript);
    setIsVoiceModalOpen(true);
  }

  async function handleSubmitVoiceExpense(values: {
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

    try {
      await createExpenseMutation.mutateAsync({
        planId: selectedPlanId,
        amount: values.amount,
        currency: values.currency,
        category: values.category,
        method: values.method,
        notes: values.notes ?? lastVoiceTranscript,
        timestamp: isoTimestamp
      });
      toast({ status: 'success', title: '语音记账已保存' });
      setIsVoiceModalOpen(false);
      setVoiceDefaults(null);
      setLastVoiceTranscript('');
    } catch (error) {
      const description = error instanceof Error ? error.message : '保存费用记录失败，请稍后再试。';
      toast({ status: 'error', title: '保存失败', description });
      throw error;
    }
  }

  return (
    <Stack spacing={6} pb={10} maxW="6xl">
      <Heading size="lg">费用预算与管理</Heading>
      <Text color="gray.600">选择旅行计划后，可通过语音或表单快速记账，并查看各类开销分析。</Text>

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

            {remainingBudget !== null ? (
              remainingBudget < 0 ? (
                <Alert status="error" variant="left-accent" mt={4}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    预算已超支 {formatCurrency(Math.abs(remainingBudget), selectedPlan.currency)}，建议检查大额消费或调整预期。
                  </AlertDescription>
                </Alert>
              ) : remainingRatio !== null && remainingRatio < 0.2 ? (
                <Alert status="warning" variant="left-accent" mt={4}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    剩余预算不足 20%，请留意后续开销。
                  </AlertDescription>
                </Alert>
              ) : null
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {selectedPlan ? (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">语音快速记账</Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="gray.600">
                上传语音文件或直接录制，系统会尝试识别金额、分类与支付方式，提交前可在弹窗中微调。
              </Text>
              <VoiceUpload
                onTranscript={(value) => setLastVoiceTranscript(value)}
                onAudioProcessed={(payload) => void handleVoiceAudioProcessed(payload)}
                isBusy={createExpenseMutation.isPending}
              />
              {lastVoiceTranscript ? (
                <Alert status="info" variant="left-accent">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    语音转写：{lastVoiceTranscript}
                  </AlertDescription>
                </Alert>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {selectedPlan ? (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">开销分析</Heading>
          </CardHeader>
          <CardBody>
            {(!expenses || expenses.length === 0) ? (
              <Text color="gray.600">暂无费用记录，可先通过下方表单添加或语音记账。</Text>
            ) : (
              <Stack spacing={6}>
                <Box>
                  <Heading size="sm" mb={3}>按分类分布</Heading>
                  <Stack spacing={3}>
                    {categoryBreakdown.map((item) => (
                      <Box key={item.category}>
                        <Flex justify="space-between" align="baseline" mb={1}>
                          <Text fontSize="sm" color="gray.700">
                            {item.category}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {formatCurrency(item.amount, selectedPlan.currency)}
                          </Text>
                        </Flex>
                        <Progress
                          colorScheme="cyan"
                          size="sm"
                          borderRadius="md"
                          value={(item.amount / maxCategoryAmount) * 100}
                          hasStripe={item.amount === maxCategoryAmount && categoryBreakdown.length > 1}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <Heading size="sm" mb={3}>按日期分布</Heading>
                  <Stack spacing={2}>
                    {dailyBreakdown.map((item) => (
                      <Flex key={item.date} justify="space-between" align="center" borderWidth="1px" borderColor="gray.200" rounded="md" px={3} py={2} bg="gray.50">
                        <Text fontSize="sm" color="gray.700">
                          {formatDateLabel(item.date)}
                        </Text>
                        <Text fontSize="sm" color="gray.800">
                          {formatCurrency(item.amount, selectedPlan.currency)}
                        </Text>
                      </Flex>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            )}
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

      <ExpenseQuickAddModal
        isOpen={Boolean(isVoiceModalOpen && selectedPlan)}
        onClose={() => {
          if (!createExpenseMutation.isPending) {
            setIsVoiceModalOpen(false);
            setVoiceDefaults(null);
            setLastVoiceTranscript('');
          }
        }}
        defaults={voiceDefaults ?? {
          amount: null,
          currency: selectedPlan?.currency ?? 'CNY',
          category: null,
          method: null,
          notes: lastVoiceTranscript
        }}
        planCurrency={selectedPlan?.currency ?? null}
        onSubmit={handleSubmitVoiceExpense}
        isSubmitting={createExpenseMutation.isPending}
      />
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

function formatDateLabel(dateKey: string): string {
  if (dateKey === '未知日期') {
    return '未知日期';
  }

  try {
    const date = new Date(dateKey);
    if (Number.isNaN(date.getTime())) {
      return dateKey;
    }
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric'
    }).format(date);
  } catch {
    return dateKey;
  }
}
