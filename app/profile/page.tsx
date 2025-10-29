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
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Spinner,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import {
  fetchCurrentProfile,
  type ProfileRecord,
  type UpdateProfileInput,
  updateProfile
} from '../../lib/supabaseQueries';

const COMMON_CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD'];

export default function ProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();

  const [displayName, setDisplayName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [companionCount, setCompanionCount] = useState('');

  const syncStateFromProfile = useCallback((profile: ProfileRecord) => {
    setDisplayName(profile.displayName ?? '');
    setDefaultCurrency(profile.defaultCurrency ?? '');
    setCompanionCount(
      profile.defaultCompanionCount !== null ? String(profile.defaultCompanionCount) : ''
    );
  }, []);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchCurrentProfile,
    enabled: Boolean(session),
    staleTime: 60_000
  });

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (nextProfile: ProfileRecord) => {
      queryClient.setQueryData(['profile'], nextProfile);
      syncStateFromProfile(nextProfile);
      toast({ status: 'success', title: '资料已更新' });
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : '保存资料失败，请稍后再试。';
      toast({ status: 'error', title: '保存失败', description });
    }
  });

  const profileData = profileQuery.data ?? null;

  useEffect(() => {
    if (profileData) {
      syncStateFromProfile(profileData);
    } else if (!profileQuery.isLoading && session) {
      setDisplayName('');
      setDefaultCurrency('');
      setCompanionCount('');
    }
  }, [profileData, profileQuery.isLoading, session, syncStateFromProfile]);

  const normalizedDisplayName = displayName.trim();
  const normalizedCurrency = defaultCurrency.trim().toUpperCase();
  const baseCurrency = profileData?.defaultCurrency ? profileData.defaultCurrency.toUpperCase() : '';
  const baseDisplayName = profileData?.displayName ?? '';
  const normalizedCompanion = useMemo(() => {
    if (!companionCount.trim()) {
      return null;
    }
    const parsed = Number(companionCount);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }, [companionCount]);

  const baseCompanion = profileData?.defaultCompanionCount ?? null;
  const isCompanionInvalid = Boolean(companionCount.trim()) && normalizedCompanion === null;

  const isDirty = useMemo(() => {
    if (!session) {
      return false;
    }
    const displayNameChanged = normalizedDisplayName !== baseDisplayName;
    const currencyChanged = normalizedCurrency !== baseCurrency;
    const companionChanged = normalizedCompanion !== baseCompanion;
    return displayNameChanged || currencyChanged || companionChanged;
  }, [
    baseCompanion,
    baseCurrency,
    baseDisplayName,
    normalizedCompanion,
    normalizedCurrency,
    normalizedDisplayName,
    session
  ]);

  const isSubmitting = mutation.isPending;
  const isLoading = isAuthLoading || (session ? profileQuery.isLoading : false);
  const shouldDisableSubmit = !isDirty || isSubmitting || isCompanionInvalid;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      toast({ status: 'warning', title: '请先登录账号' });
      return;
    }

    if (isCompanionInvalid) {
      toast({ status: 'warning', title: '请输入有效的同行人数', description: '人数需要为 0 或正整数。' });
      return;
    }

    const payload: UpdateProfileInput = {};
    let hasChange = false;

    if (normalizedDisplayName !== baseDisplayName) {
      payload.displayName = normalizedDisplayName || null;
      hasChange = true;
    }

    if (normalizedCurrency !== baseCurrency) {
      payload.defaultCurrency = normalizedCurrency || null;
      hasChange = true;
    }

    if (normalizedCompanion !== baseCompanion) {
      payload.defaultCompanionCount = normalizedCompanion;
      hasChange = true;
    }

    if (!hasChange) {
      toast({ status: 'info', title: '暂无需要保存的变更' });
      return;
    }

    await mutation.mutateAsync(payload);
  }

  return (
    <Stack spacing={6} align="flex-start">
      <Box>
        <Heading size="lg">用户资料</Heading>
        <Text mt={2} color="gray.600">
          管理个人称呼、默认币种与同行人数，便于下次快速生成行程与记账。
        </Text>
      </Box>

      {isLoading ? (
        <Card w="full" maxW="640px">
          <CardBody>
            <Stack direction="row" align="center" spacing={3} color="gray.500">
              <Spinner size="sm" />
              <Text>正在加载资料...</Text>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {!session && !isAuthLoading ? (
        <Alert status="info" variant="left-accent" w="full" maxW="640px">
          <AlertIcon />
          <AlertDescription>登录后即可编辑个人资料与偏好设置。</AlertDescription>
        </Alert>
      ) : null}

      {profileQuery.error ? (
        <Alert status="error" variant="left-accent" w="full" maxW="640px">
          <AlertIcon />
          <AlertDescription>
            {profileQuery.error instanceof Error
              ? profileQuery.error.message
              : '加载资料失败，请稍后刷新页面重试。'}
          </AlertDescription>
        </Alert>
      ) : null}

      {session ? (
        <Box as="form" onSubmit={handleSubmit} w="full" maxW="640px">
          <Card>
            <CardHeader>
              <Stack spacing={1}>
                <Heading size="md">基本信息</Heading>
                <Text color="gray.600">这些设置会在生成计划或快速记账时作为默认值。</Text>
              </Stack>
            </CardHeader>
            <CardBody>
              <Stack spacing={6}>
                <FormControl>
                  <FormLabel>邮箱</FormLabel>
                  <Input value={profileData?.email ?? session.user.email ?? ''} isReadOnly variant="filled" />
                </FormControl>

                <FormControl>
                  <FormLabel>显示昵称</FormLabel>
                  <Input
                    placeholder="用于行程称呼，例如：小王"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={50}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>默认币种</FormLabel>
                  <Input
                    list="profile-currency-options"
                    placeholder="例如：CNY"
                    value={defaultCurrency}
                    onChange={(event) => setDefaultCurrency(event.target.value)}
                    maxLength={6}
                  />
                  <datalist id="profile-currency-options">
                    {COMMON_CURRENCIES.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                  <FormHelperText>未填写时默认使用 CNY。</FormHelperText>
                </FormControl>

                <FormControl isInvalid={isCompanionInvalid}>
                  <FormLabel>默认同行人数</FormLabel>
                  <NumberInput
                    min={0}
                    max={99}
                    value={companionCount}
                    onChange={(valueAsString) => setCompanionCount(valueAsString)}
                    clampValueOnBlur={false}
                  >
                    <NumberInputField placeholder="例如：2" />
                  </NumberInput>
                  <FormHelperText>可用于行程与预算估算，留空表示暂不设定。</FormHelperText>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="cyan"
                  alignSelf="flex-start"
                  isDisabled={shouldDisableSubmit}
                  isLoading={isSubmitting}
                >
                  保存变更
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </Box>
      ) : null}
    </Stack>
  );
}
