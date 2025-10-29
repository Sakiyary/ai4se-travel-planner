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
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ItineraryViewer } from '../../../components/planner/ItineraryViewer';
import { VoiceUpload } from '../../../components/planner/VoiceUpload';
import { BudgetSummary } from '../../../components/planner/BudgetSummary';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import {
  createExpense,
  type CreateExpenseInput,
  deletePlan,
  fetchExpenses,
  fetchPlanDetail,
  fetchVoiceNotes,
  type VoiceNoteRecord,
  updatePlan
} from '../../../lib/supabaseQueries';
import type { ParsedItinerary } from '../../../services/llm';
import { ROUTES } from '../../../lib/constants';
import { getVoiceNoteSignedUrl, removeVoiceNote, storeVoiceNote } from '../../../services/voiceNotes';
import { parseExpenseFromTranscript } from '../../../lib/voiceExpenseParser';
import { ExpenseQuickAddModal } from '../../../components/expenses/ExpenseQuickAddModal';

export default function PlanDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useParams<{ planId: string }>();
  const planId = params?.planId;
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();

  useEffect(() => {
    if (!isAuthLoading && !session) {
      const loginRoute = ROUTES.LOGIN as Route;
      toast({ status: 'info', title: '请先登录', description: '登录后即可查看和管理旅行计划。' });
      router.replace(loginRoute);
    }
  }, [isAuthLoading, session, router, toast]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['plan-detail', planId],
    queryFn: () => fetchPlanDetail(planId!),
    enabled: Boolean(session && planId),
    staleTime: 60_000
  });

  const {
    data: voiceNotes,
    isLoading: isVoiceNotesLoading,
    error: voiceNotesError
  } = useQuery({
    queryKey: ['voice-notes', planId],
    queryFn: () => fetchVoiceNotes(planId!),
    enabled: Boolean(session && planId),
    staleTime: 30_000
  });

  const {
    data: expenses,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
    error: expensesError
  } = useQuery({
    queryKey: ['expenses', planId],
    queryFn: () => fetchExpenses(planId!),
    enabled: Boolean(session && planId),
    staleTime: 30_000
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof (error as { message?: string }).message === 'string') {
      return (error as { message?: string }).message;
    }
    return '加载旅行计划详情失败，请稍后再试。';
  }, [error]);

  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [partySizeInput, setPartySizeInput] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('');
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState('');
  const [voiceNoteUrls, setVoiceNoteUrls] = useState<Record<string, string>>({});
  const [expenseDraft, setExpenseDraft] = useState<{
    note: VoiceNoteRecord;
    planCurrency: string | null;
    defaults: ReturnType<typeof parseExpenseFromTranscript>;
  } | null>(null);

  const expensesSummary = useMemo(() => {
    if (!expenses) {
      return null;
    }

    let total = 0;
    let latest: string | null = null;

    expenses.forEach((expense) => {
      total += expense.amount;
      const source = expense.timestamp ?? expense.created_at;
      if (!source) {
        return;
      }
      if (!latest) {
        latest = source;
        return;
      }
      if (new Date(source).getTime() > new Date(latest).getTime()) {
        latest = source;
      }
    });

    return {
      total,
      count: expenses.length,
      latest
    };
  }, [expenses]);

  const lastExpenseAtText = useMemo(() => {
    if (!expensesSummary?.latest) {
      return null;
    }
    return formatDateTime(expensesSummary.latest);
  }, [expensesSummary]);

  const expensesErrorMessage = useMemo(() => {
    if (!isExpensesError) {
      return null;
    }
    if (expensesError instanceof Error) {
      return expensesError.message;
    }
    if (typeof expensesError === 'string') {
      return expensesError;
    }
    return '加载费用记录失败，请稍后再试。';
  }, [isExpensesError, expensesError]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setStartDateInput(data.plan.start_date ?? '');
    setEndDateInput(data.plan.end_date ?? '');
    setPartySizeInput(
      data.plan.party_size === null || data.plan.party_size === undefined
        ? ''
        : String(data.plan.party_size)
    );
    if (data.plan.budget === null || data.plan.budget === undefined) {
      setBudgetInput('');
    } else {
      const numericBudget = Number(data.plan.budget);
      setBudgetInput(Number.isFinite(numericBudget) ? String(numericBudget) : '');
    }
    setCurrencyInput((data.plan.currency ?? 'CNY').toUpperCase());
  }, [data]);

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      if (!planId) {
        throw new Error('缺少计划 ID。');
      }

      const startDate = startDateInput.trim() || null;
      const endDate = endDateInput.trim() || null;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new Error('结束日期不能早于开始日期。');
      }

      const partySizeValue = partySizeInput.trim()
        ? Number(partySizeInput.trim())
        : null;

      if (partySizeValue !== null && (!Number.isFinite(partySizeValue) || partySizeValue < 0)) {
        throw new Error('同行人数必须是非负数字。');
      }

      const budgetValue = budgetInput.trim() ? Number(budgetInput.trim()) : null;

      if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0)) {
        throw new Error('预算必须是非负数字。');
      }

      const currencyValue = currencyInput.trim() ? currencyInput.trim().toUpperCase() : null;

      return updatePlan(planId, {
        startDate,
        endDate,
        partySize: partySizeValue,
        budget: budgetValue,
        currency: currencyValue
      });
    },
    onSuccess: () => {
      toast({ status: 'success', title: '计划信息已更新' });
      queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (mutationError: unknown) => {
      const description =
        mutationError instanceof Error ? mutationError.message : '更新计划信息失败，请稍后再试。';
      toast({ status: 'error', title: '更新失败', description });
    }
  });

  const deletePlanMutation = useMutation({
    mutationFn: async () => {
      if (!planId) {
        throw new Error('缺少计划 ID。');
      }
      await deletePlan(planId);
    },
    onSuccess: () => {
      toast({ status: 'success', title: '计划已删除' });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      router.replace(ROUTES.DASHBOARD as Route);
    },
    onError: (mutationError: unknown) => {
      const description =
        mutationError instanceof Error ? mutationError.message : '删除计划失败，请稍后再试。';
      toast({ status: 'error', title: '删除失败', description });
    }
  });

  const createVoiceNoteMutation = useMutation({
    mutationFn: async (payload: { blob: Blob; transcript: string; durationMs?: number | null }) => {
      if (!planId) {
        throw new Error('缺少计划 ID。');
      }
      return storeVoiceNote({
        planId,
        blob: payload.blob,
        transcript: payload.transcript,
        durationMs: payload.durationMs ?? null
      });
    },
    onSuccess: () => {
      toast({ status: 'success', title: '语音笔记已保存' });
      queryClient.invalidateQueries({ queryKey: ['voice-notes', planId] });
    },
    onError: (mutationError: unknown) => {
      const description =
        mutationError instanceof Error ? mutationError.message : '保存语音笔记失败，请稍后再试。';
      toast({ status: 'error', title: '保存失败', description });
    }
  });

  const deleteVoiceNoteMutation = useMutation({
    mutationFn: async (note: VoiceNoteRecord) => {
      await removeVoiceNote(note.id, note.storage_path);
    },
    onSuccess: () => {
      toast({ status: 'success', title: '语音笔记已删除' });
      queryClient.invalidateQueries({ queryKey: ['voice-notes', planId] });
    },
    onError: (mutationError: unknown) => {
      const description =
        mutationError instanceof Error ? mutationError.message : '删除语音笔记失败，请稍后再试。';
      toast({ status: 'error', title: '删除失败', description });
    }
  });

  const createExpenseFromVoiceMutation = useMutation({
    mutationFn: async (input: CreateExpenseInput) => createExpense(input),
    onSuccess: () => {
      toast({ status: 'success', title: '已记录费用' });
      queryClient.invalidateQueries({ queryKey: ['expenses', planId] });
      setExpenseDraft(null);
    },
    onError: (mutationError: unknown) => {
      const description =
        mutationError instanceof Error ? mutationError.message : '保存费用记录失败，请稍后再试。';
      toast({ status: 'error', title: '保存失败', description });
    }
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updatePlanMutation.mutate();
  }

  async function handleDelete() {
    if (!planId) {
      return;
    }

    const confirmed = window.confirm('删除后将无法恢复该计划，确定要删除吗？');
    if (!confirmed) {
      return;
    }

    deletePlanMutation.mutate();
  }

  async function handleVoiceAudioProcessed(payload: {
    blob: Blob;
    transcript: string;
    durationMs?: number | null;
  }) {
    if (!payload.transcript.trim()) {
      toast({ status: 'warning', title: '语音转写为空', description: '请重新录制或上传更清晰的语音。' });
      return;
    }

    setLastVoiceTranscript(payload.transcript);

    try {
      await createVoiceNoteMutation.mutateAsync({
        blob: payload.blob,
        transcript: payload.transcript,
        durationMs: payload.durationMs ?? null
      });
    } catch {
      // toast 已在 mutation onError 中处理
    }
  }

  async function handlePreviewVoiceNote(note: VoiceNoteRecord) {
    if (voiceNoteUrls[note.id]) {
      return;
    }

    try {
      const url = await getVoiceNoteSignedUrl(note.storage_path);
      setVoiceNoteUrls((prev) => ({ ...prev, [note.id]: url }));
    } catch (error) {
      const description = error instanceof Error ? error.message : '获取语音播放链接失败。';
      toast({ status: 'error', title: '无法播放语音', description });
    }
  }

  async function handleDeleteVoiceNote(note: VoiceNoteRecord) {
    if (deleteVoiceNoteMutation.isPending) {
      return;
    }

    try {
      await deleteVoiceNoteMutation.mutateAsync(note);
      setVoiceNoteUrls((prev) => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
    } catch {
      // toast handled in mutation
    }
  }

  function handleConvertVoiceNoteToExpense(note: VoiceNoteRecord) {
    if (!note.transcript?.trim()) {
      toast({ status: 'warning', title: '无法识别语音内容', description: '该语音暂未生成转写结果。' });
      return;
    }

    const defaults = parseExpenseFromTranscript(note.transcript);
    setExpenseDraft({
      note,
      planCurrency: data?.plan.currency ?? null,
      defaults
    });
  }

  async function handleSubmitExpenseFromVoice(values: {
    amount: number;
    currency: string;
    category: string | null;
    method: string | null;
    notes: string | null;
    timestamp: string;
  }) {
    if (!planId) {
      throw new Error('缺少计划 ID。');
    }

    let isoTimestamp: string | null = null;
    if (values.timestamp) {
      const parsed = new Date(values.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        isoTimestamp = parsed.toISOString();
      }
    }

    await createExpenseFromVoiceMutation.mutateAsync({
      planId,
      amount: values.amount,
      currency: values.currency || data?.plan.currency || 'CNY',
      category: values.category,
      method: values.method,
      notes: values.notes ?? expenseDraft?.defaults?.notes ?? null,
      timestamp: isoTimestamp
    });
  }

  const itineraryData = useMemo<ParsedItinerary | null>(() => {
    if (!data) {
      return null;
    }

    const totalBudget = typeof data.plan.budget === 'number'
      ? data.plan.budget
      : data.totalActivityBudget ?? 0;

    const planPartySize =
      typeof data.plan.party_size === 'number' && data.plan.party_size > 0
        ? data.plan.party_size
        : 2;

    return {
      title: data.plan.title,
      destination: data.plan.destination ?? null,
      partySize: planPartySize,
      budget: {
        total: totalBudget
      },
      itinerary: data.days.map((day) => ({
        day: day.day,
        summary: day.summary ?? '',
        activities: day.activities.map((activity) => ({
          title: activity.title,
          description: activity.description ?? undefined,
          city: activity.city ?? undefined,
          budget: activity.budget ?? undefined,
          startTime: activity.startTime ?? undefined,
          endTime: activity.endTime ?? undefined,
          poiId:
            typeof activity.locationId === 'string' && /^B0[0-9A-Z]{8}$/i.test(activity.locationId)
              ? activity.locationId
              : undefined
        }))
      }))
    } satisfies ParsedItinerary;
  }, [data]);

  if (isAuthLoading || (!session && typeof window !== 'undefined')) {
    return (
      <Stack spacing={4} align="center" justify="center" minH="50vh">
        <Spinner size="lg" color="cyan.500" />
        <Text color="gray.600">正在加载登录状态...</Text>
      </Stack>
    );
  }

  if (!planId) {
    return (
      <Alert status="error" variant="left-accent">
        <AlertIcon />
        <AlertDescription>无效的计划链接。</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack spacing={4} align="center" justify="center" minH="50vh">
        <Spinner size="lg" color="cyan.500" />
        <Text color="gray.600">正在获取旅行计划详情...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack spacing={4} maxW="600px">
        <Alert status="error" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">{errorMessage}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline" alignSelf="flex-start">
          重新加载
        </Button>
      </Stack>
    );
  }

  if (!data || !itineraryData) {
    return (
      <Alert status="warning" variant="left-accent">
        <AlertIcon />
        <AlertDescription>未找到旅行计划详情，可能已被删除。</AlertDescription>
      </Alert>
    );
  }

  const createdAtText = formatDateTime(data.plan.created_at);
  const budgetText = formatCurrency(data.plan.budget ?? data.totalActivityBudget, data.plan.currency);

  return (
    <Stack spacing={6} pb={8} maxW="5xl">
      <Button variant="outline" size="sm" alignSelf="flex-start" onClick={() => router.push(ROUTES.DASHBOARD as Route)}>
        返回我的计划
      </Button>

      <Stack spacing={3}>
        <Heading size="lg">{data.plan.title}</Heading>
        <Text color="gray.600">{data.plan.destination ?? '目的地待补充'}</Text>
      </Stack>

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">计划概览</Heading>
        </CardHeader>
        <CardBody>
          <Box as="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={6}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <MetaItem label="创建时间" value={createdAtText} />
              <MetaItem label="AI 规划预算合计" value={formatCurrency(data.totalActivityBudget, data.plan.currency)} />
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>开始日期</FormLabel>
                <Input type="date" value={startDateInput} onChange={(event) => setStartDateInput(event.target.value)} />
              </FormControl>

              <FormControl>
                <FormLabel>结束日期</FormLabel>
                <Input type="date" value={endDateInput} onChange={(event) => setEndDateInput(event.target.value)} />
              </FormControl>

              <FormControl>
                <FormLabel>同行人数</FormLabel>
                <Input
                  type="number"
                  min={0}
                  value={partySizeInput}
                  onChange={(event) => setPartySizeInput(event.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>预算总额</FormLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={budgetInput}
                  onChange={(event) => setBudgetInput(event.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>币种</FormLabel>
                <Input value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value)} />
              </FormControl>
            </SimpleGrid>

            <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
              <Button
                type="submit"
                colorScheme="cyan"
                isLoading={updatePlanMutation.isPending}
                loadingText="保存中"
              >
                保存更改
              </Button>
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleDelete}
                isLoading={deletePlanMutation.isPending}
              >
                删除计划
              </Button>
              <Button variant="ghost" onClick={() => refetch()} isDisabled={updatePlanMutation.isPending}>
                恢复最新数据
              </Button>
            </Stack>
          </Box>
        </CardBody>
      </Card>

      <BudgetSummary
        plan={data.plan}
        days={data.days}
        totalActivityBudget={data.totalActivityBudget}
        actualSpent={expensesSummary ? expensesSummary.total : null}
        expensesCount={expensesSummary?.count ?? null}
        lastExpenseAt={lastExpenseAtText}
        isExpensesLoading={isExpensesLoading}
        expensesError={expensesErrorMessage}
      />

      {data.totalActivityBudget && data.plan.budget && Math.abs(data.plan.budget - data.totalActivityBudget) > 1 ? (
        <Alert status="info" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            AI 规划的活动预算合计约为 {formatCurrency(data.totalActivityBudget, data.plan.currency)}，可与总预算 {budgetText} 对比调整。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">语音笔记与语音记账</Heading>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            <VoiceUpload
              onTranscript={(value) => setLastVoiceTranscript(value)}
              onAudioProcessed={({ blob, transcript, durationMs }) =>
                void handleVoiceAudioProcessed({ blob, transcript, durationMs })
              }
              isBusy={createVoiceNoteMutation.isPending}
            />

            {lastVoiceTranscript ? (
              <Alert status="info" variant="left-accent">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  最新语音转写：{lastVoiceTranscript}
                </AlertDescription>
              </Alert>
            ) : null}

            {voiceNotesError ? (
              <Alert status="error" variant="left-accent">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  {voiceNotesError instanceof Error ? voiceNotesError.message : '加载语音笔记失败'}
                </AlertDescription>
              </Alert>
            ) : null}

            {isVoiceNotesLoading ? (
              <Stack spacing={3} align="center" justify="center" minH="160px">
                <Spinner size="md" color="cyan.500" />
                <Text fontSize="sm" color="gray.600">
                  正在获取语音笔记...
                </Text>
              </Stack>
            ) : (voiceNotes?.length ?? 0) > 0 ? (
              <Stack spacing={3}>
                {voiceNotes!.map((note) => (
                  <Box key={note.id} borderWidth="1px" borderColor="gray.200" rounded="md" p={4} bg="gray.50">
                    <Stack spacing={2}>
                      <Text fontSize="sm" color="gray.600">
                        创建于：{formatDateTime(note.created_at)}
                      </Text>
                      {note.transcript ? (
                        <Text fontSize="sm" color="gray.800">
                          {note.transcript}
                        </Text>
                      ) : (
                        <Text fontSize="sm" color="gray.500">
                          暂无转写内容。
                        </Text>
                      )}
                      <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} align="center">
                        {voiceNoteUrls[note.id] ? (
                          <audio
                            controls
                            preload="metadata"
                            src={voiceNoteUrls[note.id]}
                            style={{ width: '100%' }}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handlePreviewVoiceNote(note)}
                          >
                            生成播放链接
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => void handleDeleteVoiceNote(note)}
                          isDisabled={deleteVoiceNoteMutation.isPending}
                        >
                          删除
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="cyan"
                          variant="outline"
                          onClick={() => handleConvertVoiceNoteToExpense(note)}
                          isDisabled={!note.transcript || createExpenseFromVoiceMutation.isPending}
                        >
                          记录为开销
                        </Button>
                        {typeof note.duration_seconds === 'number' ? (
                          <Text fontSize="xs" color="gray.500">
                            时长：{formatDurationSeconds(note.duration_seconds)}
                          </Text>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Text fontSize="sm" color="gray.500">
                还没有语音笔记，可通过上方录音或上传语音快速补充需求、记账或留存灵感。
              </Text>
            )}
          </Stack>
        </CardBody>
      </Card>

      <Box>
        <Heading size="md" mb={3}>
          每日行程
        </Heading>
        <ItineraryViewer itinerary={itineraryData} />
      </Box>

      {data.days.length === 0 ? (
        <Alert status="warning" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            当前计划暂未包含详细行程，可返回行程规划器重新生成或手动补充。
          </AlertDescription>
        </Alert>
      ) : null}

      <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
        <Button colorScheme="cyan" onClick={() => router.push(ROUTES.PLANNER as Route)}>
          重新生成行程
        </Button>
        <Button variant="outline" onClick={() => refetch()}>
          刷新数据
        </Button>
      </Stack>

      <ExpenseQuickAddModal
        isOpen={Boolean(expenseDraft)}
        onClose={() => {
          if (!createExpenseFromVoiceMutation.isPending) {
            setExpenseDraft(null);
          }
        }}
        defaults={expenseDraft?.defaults ?? {
          amount: null,
          currency: data?.plan.currency ?? 'CNY',
          category: null,
          method: null,
          notes: expenseDraft?.defaults?.notes ?? ''
        }}
        planCurrency={expenseDraft?.planCurrency ?? data?.plan.currency ?? null}
        onSubmit={handleSubmitExpenseFromVoice}
        isSubmitting={createExpenseFromVoiceMutation.isPending}
      />
    </Stack>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="md" p={4} bg="gray.50">
      <Text fontSize="sm" color="gray.500">
        {label}
      </Text>
      <Text fontWeight="bold" color="gray.800" mt={1}>
        {value}
      </Text>
    </Box>
  );
}

function formatDateTime(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return value;
  }
}

function formatCurrency(amount: number | null | undefined, currency: string | null): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
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

function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '约 0 秒';
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds} 秒`;
  }

  return `${minutes} 分 ${remainingSeconds.toString().padStart(2, '0')} 秒`;
}
