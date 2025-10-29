"use client";

import {
  Badge,
  Box,
  IconButton,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr
} from '@chakra-ui/react';
import { Trash2 } from 'lucide-react';
import type { ExpenseRecord } from '../../lib/supabaseQueries';

interface ExpenseListProps {
  expenses: ExpenseRecord[];
  currency?: string | null;
  onDelete?: (expenseId: string) => void;
  deletingId?: string | null;
}

export function ExpenseList({ expenses, currency = 'CNY', onDelete, deletingId }: ExpenseListProps) {
  if (!expenses || expenses.length === 0) {
    return (
      <Box borderWidth="1px" borderStyle="dashed" borderColor="gray.300" p={6} rounded="lg" textAlign="center">
        <Text color="gray.600">当前计划还没有费用记录，使用上方表单添加第一条开销。</Text>
      </Box>
    );
  }

  return (
    <Table size="sm" variant="striped" colorScheme="gray">
      <Thead>
        <Tr>
          <Th>发生时间</Th>
          <Th>分类</Th>
          <Th>金额</Th>
          <Th>支付方式</Th>
          <Th>备注</Th>
          {onDelete ? <Th width="64px">操作</Th> : null}
        </Tr>
      </Thead>
      <Tbody>
        {expenses.map((expense) => (
          <Tr key={expense.id}>
            <Td>{formatDateTime(expense.timestamp)}</Td>
            <Td>
              {expense.category ? <Badge colorScheme="cyan">{expense.category}</Badge> : <Text color="gray.500">未分类</Text>}
            </Td>
            <Td fontWeight="bold">
              {formatCurrency(expense.amount, expense.currency ?? currency ?? 'CNY')}
            </Td>
            <Td>{expense.method ?? <Text color="gray.500">未填写</Text>}</Td>
            <Td>
              <Text noOfLines={2} maxW="260px">
                {expense.notes ?? '—'}
              </Text>
            </Td>
            {onDelete ? (
              <Td>
                <Tooltip label="删除记录">
                  <IconButton
                    aria-label="删除记录"
                    icon={deletingId === expense.id ? <Spinner size="sm" /> : <Trash2 size={16} />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => onDelete(expense.id)}
                    isDisabled={Boolean(deletingId)}
                  />
                </Tooltip>
              </Td>
            ) : null}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

function formatDateTime(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return value;
  }
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}
