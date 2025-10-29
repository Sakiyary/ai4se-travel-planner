import { Button, Heading, Stack, Text } from '@chakra-ui/react';
import type { Route } from 'next';
import Link from 'next/link';
import { ROUTES } from '../lib/constants';

export default function HomePage() {
  return (
    <Stack spacing={6} py={16} maxW="3xl">
      <Heading size="2xl">AI 旅行规划师</Heading>
      <Text fontSize="lg" color="gray.600">
        通过语音或文字告诉我们你的旅行需求，大模型将生成个性化行程、费用预算与费用跟踪，帮你轻松搞定下一次旅程。
      </Text>
      <Stack direction="row" spacing={4}>
        <Button as={Link} href={ROUTES.PLANNER as Route} colorScheme="cyan">
          开始规划
        </Button>
        <Button as={Link} href={ROUTES.DASHBOARD as Route} variant="outline" colorScheme="cyan">
          查看我的计划
        </Button>
      </Stack>
    </Stack>
  );
}
