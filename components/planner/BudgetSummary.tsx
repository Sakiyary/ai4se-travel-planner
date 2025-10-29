"use client";

import { useMemo } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  Spinner
} from '@chakra-ui/react';
import type { PlanDay, PlanRecord } from '../../lib/supabaseQueries';

type DailyBudget = {
  label: string;
  amount: number;
};

interface BudgetSummaryProps {
  plan: PlanRecord;
  days: PlanDay[];
  totalActivityBudget: number | null;
  actualSpent?: number | null;
  expensesCount?: number | null;
  lastExpenseAt?: string | null;
  isExpensesLoading?: boolean;
  expensesError?: string | null;
}

type BudgetSummaryComputed = {
  currency: string;
  planBudget: number | null;
  activityBudget: number | null;
  effectiveBudget: number;
  dayCount: number;
  partySize: number | null;
  averagePerDay: number | null;
  averagePerPerson: number | null;
  dailyBudgets: DailyBudget[];
  maxDailyBudget: number;
  difference: number | null;
  differenceRatio: number | null;
  hasRecordedExpenses: boolean;
  actualTotal: number | null;
  actualAveragePerDay: number | null;
  actualAveragePerPerson: number | null;
  utilization: number | null;
  actualDifference: number | null;
  actualDifferenceRatio: number | null;
  remainingBudget: number | null;
  expenseMeta: string;
};

export function BudgetSummary({
  plan,
  days,
  totalActivityBudget,
  actualSpent,
  expensesCount,
  lastExpenseAt,
  isExpensesLoading = false,
  expensesError = null
}: BudgetSummaryProps) {
  const {
    currency,
    planBudget,
    activityBudget,
    effectiveBudget,
    dayCount,
    partySize,
    averagePerDay,
    averagePerPerson,
    dailyBudgets,
    maxDailyBudget,
    difference,
    differenceRatio,
    hasRecordedExpenses,
    actualTotal,
    actualAveragePerDay,
    actualAveragePerPerson,
    utilization,
    actualDifference,
    actualDifferenceRatio,
    remainingBudget,
    expenseMeta
  } = useMemo<BudgetSummaryComputed>(() => {
    const currencyCode = plan.currency ?? 'CNY';
    const normalizedPlanBudget = typeof plan.budget === 'number' && Number.isFinite(plan.budget) ? plan.budget : null;
    const normalizedActivityBudget = typeof totalActivityBudget === 'number' && Number.isFinite(totalActivityBudget)
      ? totalActivityBudget
      : null;

    const dayBudgetList = days.map<DailyBudget>((day) => {
      const total = day.activities.reduce((sum, activity) => sum + (activity.budget ?? 0), 0);
      return {
        label: `第 ${day.day} 天`,
        amount: total
      };
    });

    const aggregatedActivityBudget = dayBudgetList.reduce((sum, item) => sum + item.amount, 0);
    const fallbackActivityBudget = normalizedActivityBudget ?? aggregatedActivityBudget;
    const totalBudget = normalizedPlanBudget ?? fallbackActivityBudget;
    const totalDays = days.length;
    const travelers = typeof plan.party_size === 'number' && plan.party_size > 0 ? plan.party_size : null;

    const dailyAverage = totalDays > 0 ? totalBudget / totalDays : null;
    const perPersonAverage = travelers ? totalBudget / travelers : null;

    const dailyMax = dayBudgetList.length > 0 ? Math.max(...dayBudgetList.map((item) => item.amount)) : 0;

    const budgetDifference = normalizedPlanBudget !== null && normalizedActivityBudget !== null
      ? normalizedPlanBudget - normalizedActivityBudget
      : null;

    const budgetDiffRatio = budgetDifference !== null && normalizedActivityBudget
      ? budgetDifference / normalizedActivityBudget
      : null;

    const actualTotalValue = typeof actualSpent === 'number' && Number.isFinite(actualSpent)
      ? actualSpent
      : null;

    const hasExpenses = typeof expensesCount === 'number'
      ? expensesCount > 0
      : actualTotalValue !== null;

    const actualPerDay = actualTotalValue !== null && totalDays > 0 ? actualTotalValue / totalDays : null;
    const actualPerPerson = actualTotalValue !== null && travelers ? actualTotalValue / travelers : null;
    const usageRatio = actualTotalValue !== null && totalBudget > 0 ? actualTotalValue / totalBudget : null;
    const actualDiff = actualTotalValue !== null ? actualTotalValue - totalBudget : null;
    const actualDiffRatio = actualDiff !== null && totalBudget > 0 ? actualDiff / totalBudget : null;
    const remaining = actualTotalValue !== null ? totalBudget - actualTotalValue : null;

    const countText = typeof expensesCount === 'number' ? `共 ${expensesCount} 笔` : null;
    const lastText = lastExpenseAt ? `最近 ${lastExpenseAt}` : null;
    const meta = [countText, lastText].filter(Boolean).join(' · ');

    return {
      currency: currencyCode,
      planBudget: normalizedPlanBudget,
      activityBudget: normalizedActivityBudget,
      effectiveBudget: totalBudget,
      dayCount: totalDays,
      partySize: travelers,
      averagePerDay: dailyAverage,
      averagePerPerson: perPersonAverage,
      dailyBudgets: dayBudgetList,
      maxDailyBudget: dailyMax,
      difference: budgetDifference,
      differenceRatio: budgetDiffRatio,
      hasRecordedExpenses: hasExpenses,
      actualTotal: actualTotalValue,
      actualAveragePerDay: actualPerDay,
      actualAveragePerPerson: actualPerPerson,
      utilization: usageRatio,
      actualDifference: actualDiff,
      actualDifferenceRatio: actualDiffRatio,
      remainingBudget: remaining,
      expenseMeta: meta
    };
  }, [
    plan,
    days,
    totalActivityBudget,
    actualSpent,
    expensesCount,
    lastExpenseAt
  ]);

  return (
    <Card variant="outline">
      <CardHeader>
        <Heading size="md">预算拆分</Heading>
      </CardHeader>
      <CardBody>
        <Stack spacing={6}>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Stat>
              <StatLabel>计划预算</StatLabel>
              <StatNumber>{formatCurrency(planBudget ?? effectiveBudget, currency)}</StatNumber>
              <StatHelpText>
                {planBudget !== null ? '用户可编辑预算' : '使用 AI 估算值'}
              </StatHelpText>
            </Stat>

            <Stat>
              <StatLabel>AI 活动预算</StatLabel>
              <StatNumber>
                {activityBudget !== null ? formatCurrency(activityBudget, currency) : '未提供'}
              </StatNumber>
              <StatHelpText>源自行程活动合计</StatHelpText>
            </Stat>

            <Stat>
              <StatLabel>平均每天</StatLabel>
              <StatNumber>
                {averagePerDay !== null ? formatCurrency(averagePerDay, currency) : '—'}
              </StatNumber>
              <StatHelpText>
                {dayCount > 0 ? `共 ${dayCount} 天` : '等待设置行程天数'}
              </StatHelpText>
            </Stat>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Stat>
              <StatLabel>人均预算</StatLabel>
              <StatNumber>
                {averagePerPerson !== null ? formatCurrency(averagePerPerson, currency) : '—'}
              </StatNumber>
              <StatHelpText>
                {partySize ? `按 ${partySize} 人` : '请先填写同行人数'}
              </StatHelpText>
            </Stat>

            <Stat>
              <StatLabel>行程天数</StatLabel>
              <StatNumber>{dayCount > 0 ? dayCount : '—'}</StatNumber>
              <StatHelpText>非均衡天数可参考下方拆分</StatHelpText>
            </Stat>

            <Stat>
              <StatLabel>预算参考值</StatLabel>
              <StatNumber>{formatCurrency(effectiveBudget, currency)}</StatNumber>
              <StatHelpText>当前用于分析的总金额</StatHelpText>
            </Stat>
          </SimpleGrid>

          {difference !== null && Math.abs(difference) > 0 ? (
            <Alert
              status={difference > 0 ? 'info' : 'warning'}
              variant="left-accent"
            >
              <AlertIcon />
              <AlertDescription fontSize="sm">
                {difference > 0
                  ? `计划预算比 AI 建议高出 ${formatCurrency(difference, currency)}${formatRatioHint(differenceRatio)}，可用于增加灵活支出。`
                  : `计划预算比 AI 建议低了 ${formatCurrency(Math.abs(difference), currency)}${formatRatioHint(differenceRatio)}，请确认是否会影响活动安排。`}
              </AlertDescription>
            </Alert>
          ) : null}

          <Box>
            <Heading size="sm" mb={3}>每日预算分布</Heading>
            {dailyBudgets.length === 0 ? (
              <Text fontSize="sm" color="gray.600">尚未补充行程活动预算，生成行程后即可看到拆分。</Text>
            ) : (
              <Stack spacing={3}>
                {dailyBudgets.map((item: DailyBudget) => (
                  <Box key={item.label}>
                    <Flex justify="space-between" align="baseline" mb={1}>
                      <Text fontSize="sm" color="gray.700">{item.label}</Text>
                      <Text fontSize="sm" color="gray.600">{formatCurrency(item.amount, currency)}</Text>
                    </Flex>
                    <BudgetBar amount={item.amount} max={maxDailyBudget} />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          <Text fontSize="sm" color="gray.600">
            提示：预算数据来自 AI 活动估算与用户自定义总额。可根据上述拆分调整每日安排，或结合费用页面跟踪实际支出。
          </Text>

          <Divider />

          <Heading size="sm">实际支出</Heading>
          {expensesError ? (
            <Alert status="error" variant="left-accent">
              <AlertIcon />
              <AlertDescription fontSize="sm">{expensesError}</AlertDescription>
            </Alert>
          ) : isExpensesLoading ? (
            <Stack direction="row" align="center" spacing={2} color="gray.600">
              <Spinner size="sm" color="cyan.500" />
              <Text fontSize="sm">正在获取费用记录...</Text>
            </Stack>
          ) : hasRecordedExpenses ? (
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                <Stat>
                  <StatLabel>已记录开销</StatLabel>
                  <StatNumber>{formatCurrency(actualTotal, currency)}</StatNumber>
                  <StatHelpText>{expenseMeta || '最新记账数据'}</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>预算使用率</StatLabel>
                  <StatNumber>{formatPercentage(utilization)}</StatNumber>
                  <StatHelpText>参考预算 {formatCurrency(effectiveBudget, currency)}</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>实际日均</StatLabel>
                  <StatNumber>{formatCurrency(actualAveragePerDay, currency)}</StatNumber>
                  <StatHelpText>{dayCount > 0 ? `按 ${dayCount} 天` : '尚未设置行程天数'}</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>实际人均</StatLabel>
                  <StatNumber>{formatCurrency(actualAveragePerPerson, currency)}</StatNumber>
                  <StatHelpText>{partySize ? `按 ${partySize} 人` : '请填写同行人数'}</StatHelpText>
                </Stat>
              </SimpleGrid>

              {actualDifference !== null && Math.abs(actualDifference) > 1 ? (
                <Alert status={actualDifference > 0 ? 'warning' : 'success'} variant="left-accent">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    {actualDifference > 0
                      ? `实际支出已超出预算 ${formatCurrency(actualDifference, currency)}${formatRatioHint(actualDifferenceRatio)}，请合理调整剩余行程或增加预算。`
                      : `当前还剩余预算 ${formatCurrency(Math.abs(actualDifference), currency)}${formatRatioHint(actualDifferenceRatio)}，可根据情况提升体验或保留应急资金。`}
                  </AlertDescription>
                </Alert>
              ) : null}

              {remainingBudget !== null && remainingBudget > 0 && actualDifference !== null && actualDifference < 0 ? (
                <Text fontSize="sm" color="gray.600">
                  预计剩余额度约为 {formatCurrency(remainingBudget, currency)}，后续行程可继续观测支出节奏。
                </Text>
              ) : null}
            </Stack>
          ) : (
            <Text fontSize="sm" color="gray.600">
              尚未记录实际开销。完成记账后，这里会展示预算使用情况与差异提醒。
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}

function BudgetBar({ amount, max }: { amount: number; max: number }) {
  if (max <= 0) {
    return (
      <Box bg="gray.200" borderRadius="md" height="8px" />
    );
  }

  const ratio = Math.min(amount / max, 1);
  return (
    <Box bg="gray.200" borderRadius="md" height="8px" overflow="hidden">
      <Box
        height="100%"
        width={`${(ratio * 100).toFixed(2)}%`}
        bg="cyan.500"
        transition="width 0.3s ease"
      />
    </Box>
  );
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null || Number.isNaN(amount)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function formatRatioHint(ratio: number | null): string {
  if (ratio === null || Number.isNaN(ratio)) {
    return '';
  }

  const percentage = Math.round(Math.abs(ratio) * 100);
  if (percentage === 0) {
    return '';
  }

  return `（约 ${percentage}%）`;
}

function formatPercentage(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}