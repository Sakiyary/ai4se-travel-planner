"use client";

import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Stack,
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';

const CATEGORY_PRESETS = ['交通', '住宿', '餐饮', '门票', '购物', '娱乐', '其他'];
const METHOD_PRESETS = ['移动支付', '信用卡', '现金', '银行转账', '其他'];

export interface ExpenseFormValues {
  amount: number;
  currency: string;
  category: string | null;
  method: string | null;
  notes: string | null;
  timestamp: string;
}

interface ExpenseFormProps {
  defaultCurrency?: string | null;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

export function ExpenseForm({ defaultCurrency = 'CNY', onSubmit, isSubmitting = false }: ExpenseFormProps) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency ?? 'CNY');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(() => buildDefaultTimestamp());

  const isAmountValid = useMemo(() => {
    const parsed = Number(amount);
    return !Number.isNaN(parsed) && parsed > 0;
  }, [amount]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAmountValid) {
      toast({ status: 'warning', title: '请输入有效的金额', description: '金额必须大于 0。' });
      return;
    }

    const parsedAmount = Number(amount);

    try {
      await onSubmit({
        amount: parsedAmount,
        currency,
        category: category.trim() ? category.trim() : null,
        method: method.trim() ? method.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        timestamp: timestamp || new Date().toISOString().slice(0, 16)
      });

      setAmount('');
      setCategory('');
      setMethod('');
      setNotes('');
      setTimestamp(buildDefaultTimestamp());
      toast({ status: 'success', title: '已记录费用' });
    } catch (error) {
      const description = error instanceof Error ? error.message : '保存费用记录失败，请稍后再试。';
      toast({ status: 'error', title: '保存失败', description });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={4}>
        <HStack spacing={4} align="flex-end" flexWrap="wrap">
          <FormControl isRequired minW={{ base: '100%', sm: '160px' }}>
            <FormLabel>金额</FormLabel>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="例如：250"
              isInvalid={amount !== '' && !isAmountValid}
            />
          </FormControl>
          <FormControl minW={{ base: '100%', sm: '140px' }}>
            <FormLabel>币种</FormLabel>
            <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          </FormControl>
          <FormControl minW={{ base: '100%', sm: '200px' }}>
            <FormLabel>分类</FormLabel>
            <Select placeholder="选择分类" value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORY_PRESETS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl minW={{ base: '100%', sm: '200px' }}>
            <FormLabel>支付方式</FormLabel>
            <Select placeholder="选择方式" value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHOD_PRESETS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>

        <FormControl>
          <FormLabel>发生时间</FormLabel>
          <Input
            type="datetime-local"
            value={timestamp}
            onChange={(event) => setTimestamp(event.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel>备注</FormLabel>
          <Textarea
            rows={3}
            placeholder="可填写商家、订单号等描述信息"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormControl>

        <Button type="submit" colorScheme="cyan" isLoading={isSubmitting} isDisabled={!isAmountValid} alignSelf="flex-start">
          添加费用
        </Button>
      </Stack>
    </form>
  );
}

function buildDefaultTimestamp(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const isoString = now.toISOString();
  return isoString.slice(0, 16);
}
