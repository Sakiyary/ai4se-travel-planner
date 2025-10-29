"use client";

import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';

const CATEGORY_OPTIONS = ['交通', '住宿', '餐饮', '门票', '购物', '娱乐', '其他'];
const METHOD_OPTIONS = ['移动支付', '信用卡', '现金', '银行转账', '其他'];

export interface ExpenseQuickAddDefaults {
  amount: number | null;
  currency: string;
  category: string | null;
  method: string | null;
  notes: string;
}

export interface ExpenseQuickAddResult {
  amount: number;
  currency: string;
  category: string | null;
  method: string | null;
  notes: string | null;
  timestamp: string;
}

interface ExpenseQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaults: ExpenseQuickAddDefaults;
  onSubmit: (result: ExpenseQuickAddResult) => Promise<void>;
  isSubmitting?: boolean;
  planCurrency?: string | null;
}

export function ExpenseQuickAddModal({
  isOpen,
  onClose,
  defaults,
  onSubmit,
  isSubmitting = false,
  planCurrency
}: ExpenseQuickAddModalProps) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaults.currency || planCurrency || 'CNY');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState(defaults.notes ?? '');
  const [timestamp, setTimestamp] = useState(buildDefaultTimestamp());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAmount(defaults.amount ? String(defaults.amount) : '');
    setCurrency((defaults.currency || planCurrency || 'CNY').toUpperCase());
    setCategory(defaults.category ?? '');
    setMethod(defaults.method ?? '');
    setNotes(defaults.notes ?? '');
    setTimestamp(buildDefaultTimestamp());
  }, [isOpen, defaults, planCurrency]);

  const isAmountValid = useMemo(() => {
    if (amount === '') {
      return false;
    }
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0;
  }, [amount]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAmountValid) {
      toast({ status: 'warning', title: '请输入有效的金额' });
      return;
    }

    const parsedAmount = Number(amount);

    await onSubmit({
      amount: parsedAmount,
      currency: currency.trim().toUpperCase() || 'CNY',
      category: category.trim() ? category.trim() : null,
      method: method.trim() ? method.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      timestamp
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit}>
        <ModalHeader>根据语音记录开销</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>金额</FormLabel>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="例如：256"
                isInvalid={amount !== '' && !isAmountValid}
              />
            </FormControl>

            <FormControl>
              <FormLabel>币种</FormLabel>
              <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </FormControl>

            <FormControl>
              <FormLabel>分类</FormLabel>
              <Select placeholder="选择分类" value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>支付方式</FormLabel>
              <Select placeholder="选择方式" value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHOD_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>发生时间</FormLabel>
              <Input type="datetime-local" value={timestamp} onChange={(event) => setTimestamp(event.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>备注</FormLabel>
              <Textarea
                rows={3}
                placeholder="可补充商家、行程等信息"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" colorScheme="cyan" isLoading={isSubmitting} isDisabled={!isAmountValid}>
            保存费用
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function buildDefaultTimestamp(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}
