"use client";

import {
  Alert,
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
  Stack,
  Text,
  Textarea,
  useToast
} from '@chakra-ui/react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { VoiceUpload } from '../../components/planner/VoiceUpload';
import { ItineraryViewer } from '../../components/planner/ItineraryViewer';
import { generateItinerary } from '../../services/llm';
import type { ParsedItinerary } from '../../services/llm';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { savePlanFromItinerary } from '../../lib/supabaseQueries';

export default function PlannerPage() {
  const toast = useToast();
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [manualText, setManualText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [itinerary, setItinerary] = useState<ParsedItinerary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDestination, setPlanDestination] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const combinedRequest = useMemo(() => {
    if (manualText && voiceText) {
      return `${manualText}\n语音补充：${voiceText}`;
    }
    return manualText || voiceText || '';
  }, [manualText, voiceText]);

  const finalPrompt = useMemo(() => buildPrompt(combinedRequest), [combinedRequest]);

  useEffect(() => {
    if (itinerary) {
      setSavedPlanId(null);
      const llmTitle = typeof itinerary.title === 'string' ? itinerary.title.trim() : '';
      const llmDestination = typeof itinerary.destination === 'string' ? itinerary.destination.trim() : '';
      const destinationFallback = deriveDefaultDestination(manualText, voiceText);

      setPlanTitle(llmTitle || deriveDefaultTitle(manualText, voiceText));
      setPlanDestination(llmDestination || destinationFallback);
    } else {
      setPlanTitle('');
      setPlanDestination('');
      setSavedPlanId(null);
    }
  }, [itinerary, manualText, voiceText]);

  async function handleGenerate() {
    if (!combinedRequest.trim()) {
      toast({ status: 'warning', title: '请先输入旅行需求', description: '可以使用语音或文本描述一次旅行。' });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateItinerary(finalPrompt);
      setItinerary(result);
      toast({ status: 'success', title: '行程生成成功', duration: 2000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '行程生成失败，请稍后再试。';
      toast({ status: 'error', title: '生成失败', description: message, duration: 4000 });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    setManualText('');
    setVoiceText('');
    setItinerary(null);
  }

  async function handleSavePlan() {
    if (!itinerary) {
      toast({ status: 'warning', title: '没有可保存的行程，请先生成。' });
      return;
    }

    if (!session) {
      const loginRoute = '/login' as Route;
      toast({ status: 'info', title: '请先登录', description: '登录后可以保存行程至个人账户。' });
      router.push(loginRoute);
      return;
    }

    const trimmedTitle = planTitle.trim();
    if (!trimmedTitle) {
      toast({ status: 'warning', title: '请填写行程标题' });
      return;
    }

    setIsSaving(true);
    try {
      const planId = await savePlanFromItinerary({
        title: trimmedTitle,
        destination: planDestination.trim() || null,
        partySize: itinerary.partySize ?? null,
        itinerary: itinerary.itinerary.map((day) => ({
          day: day.day,
          summary: day.summary,
          activities: day.activities.map((activity) => ({
            title: activity.title,
            description: activity.description,
            city: activity.city,
            budget: activity.budget,
            startTime: activity.startTime,
            endTime: activity.endTime,
            poiId: activity.poiId
          }))
        })),
        totalBudget: itinerary.budget.total
      });

      setSavedPlanId(planId);
      toast({ status: 'success', title: '行程已保存', description: '可在“我的旅行计划”中查看和管理。' });
    } catch (error) {
      const description = error instanceof Error ? error.message : '保存行程失败，请稍后重试。';
      toast({ status: 'error', title: '保存失败', description });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Stack spacing={6}>
      <Heading size="lg">行程规划器</Heading>
      <Stack direction={{ base: 'column', xl: 'row' }} spacing={6} alignItems="start">
        <Card flex="1" minW={0} variant="outline">
          <CardHeader>
            <Heading size="md">描述你的旅行需求</Heading>
            <Text fontSize="sm" color="gray.600" mt={2}>
              用自然语言描述一次旅行（目的地、日期、预算、偏好等），或直接上传语音说明。
            </Text>
          </CardHeader>
          <CardBody>
            <Stack spacing={5}>
              <Box>
                <Heading size="sm" mb={2}>
                  文本输入
                </Heading>
                <Textarea
                  placeholder="例如：我计划在 5 月底带一家四口去重庆和四川玩 5 天，总预算 2 万元，想多安排亲子活动和动漫主题景点。"
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  rows={8}
                  resize="vertical"
                />
              </Box>

              <Box>
                <Heading size="sm" mb={2}>
                  语音输入（可选）
                </Heading>
                <VoiceUpload onTranscript={setVoiceText} />
                {voiceText ? (
                  <Text mt={2} fontSize="sm" color="gray.600">
                    语音转写内容：{voiceText}
                  </Text>
                ) : null}
              </Box>

              <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
                <Button colorScheme="cyan" flex={1} onClick={handleGenerate} isLoading={isGenerating}>
                  生成行程
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  重置输入
                </Button>
              </Stack>

              <Box bg="gray.50" p={4} rounded="md">
                <Heading size="sm" color="gray.700">
                  提示词预览
                </Heading>
                <Text mt={2} fontSize="xs" color="gray.600" whiteSpace="pre-wrap">
                  {finalPrompt || '请先录入语音或文本以查看提示词。'}
                </Text>
              </Box>
            </Stack>
          </CardBody>
        </Card>

        <Card flex="1" minW={0} variant="outline">
          <CardHeader>
            <Heading size="md">规划结果</Heading>
            <Text fontSize="sm" color="gray.600" mt={2}>
              生成后可查看按天行程和预算明细。
            </Text>
          </CardHeader>
          <CardBody>
            <Stack spacing={6}>
              <ItineraryViewer itinerary={itinerary} />

              {itinerary ? (
                <Box>
                  <Heading size="sm" mb={3}>
                    保存行程
                  </Heading>
                  {isAuthLoading ? (
                    <Text fontSize="sm" color="gray.600">
                      正在检测登录状态...
                    </Text>
                  ) : session ? (
                    <Stack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>行程标题</FormLabel>
                        <Input
                          value={planTitle}
                          onChange={(event) => setPlanTitle(event.target.value)}
                          placeholder="例如：五一东京亲子游"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>目的地（可选）</FormLabel>
                        <Input
                          value={planDestination}
                          onChange={(event) => setPlanDestination(event.target.value)}
                          placeholder="例如：日本东京"
                        />
                      </FormControl>
                      <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
                        <Button
                          colorScheme="cyan"
                          onClick={handleSavePlan}
                          isLoading={isSaving}
                          isDisabled={!planTitle.trim()}
                        >
                          保存到我的计划
                        </Button>
                        {savedPlanId ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const dashboardRoute = '/dashboard' as Route;
                              router.push(dashboardRoute);
                            }}
                          >
                            查看我的计划
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={3}>
                      <Alert status="info" variant="left-accent">
                        <AlertIcon />
                        <Text fontSize="sm">
                          登录后即可保存行程并在“我的旅行计划”中查看。
                        </Text>
                      </Alert>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const loginRoute = '/login' as Route;
                          router.push(loginRoute);
                        }}
                      >
                        前往登录
                      </Button>
                    </Stack>
                  )}
                </Box>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </Stack>
  );
}

function buildPrompt(userRequest: string): string {
  const trimmed = userRequest.trim();
  const instructions = `你是一名专业旅行规划师，需要输出严格遵循以下结构的 JSON：
- 只能输出 JSON，禁止附加说明或 Markdown。
- JSON 中不要出现 null；若缺少信息请提供合理的默认值，或直接省略该字段。
- 必须生成如下键值：
  {
    "title": "字符串",
    "destination": "字符串",
    "partySize": 正整数,
    "itinerary": [
      {
        "day": 正整数,
        "summary": "字符串",
        "activities": [
          {
            "title": "字符串",
            "description": "字符串，若信息不足请写精简描述，例如 '待补充'",
            "startTime": "HH:MM 格式时间，若无法提供确切时间可使用 '00:00' 表示待定",
            "endTime": "HH:MM 格式时间，若无法提供确切时间可使用 '00:00' 表示待定",
            "city": "字符串，若不确定请写主要目的地或 '待定'",
            "budget": 数字，若不清楚请写 0,
            "poiId": "B0.... 形式的高德 POI 编号；仅在确认真实编号时填写"
          }
        ]
      }
    ],
    "budget": {
      "total": 数字,
      "transport": 数字,
      "accommodation": 数字,
      "dining": 数字,
      "activities": 数字,
      "contingency": 数字
    }
  }
- 如果用户未提及同行人数，让 "partySize" = 2；title/destination 不明确时请根据上下文给出简洁概括。
- 只有在确认地点属于该城市且知道高德真实编号时再输出 "poiId" 字段；否则省略该字段，不要伪造编号。
- activities 可以为空数组但不能为空缺失天数；金额未知时填 0；所有数值使用阿拉伯数字，时间统一 HH:MM。
- 示例（仅供格式参考）：
  {"title":"示例行程","destination":"北京","partySize":2,"itinerary":[{"day":1,"summary":"行程概览","activities":[{"title":"天安门参观","description":"上午参观天安门广场","startTime":"09:00","endTime":"11:00","city":"北京","budget":200,"poiId":"B000A7R6M2"}]}],"budget":{"total":2000,"transport":400,"accommodation":800,"dining":400,"activities":300,"contingency":100}}
- 返回的 JSON 必须可以被 JSON.parse 直接解析，不包含额外字段或尾随文本。`;

  if (!trimmed) {
    return instructions;
  }

  return `用户需求：${trimmed}\n${instructions}`;
}

function deriveDefaultTitle(manual: string, voice: string): string {
  const fallback = 'AI 行程计划';
  const source = (manual || voice || '').trim();
  if (!source) {
    return fallback;
  }

  const firstSentence = source.split(/[。.!?\n]/)[0]?.trim();
  if (!firstSentence) {
    return fallback;
  }

  return firstSentence.length > 20 ? `${firstSentence.slice(0, 20)}…` : firstSentence;
}

function deriveDefaultDestination(manual: string, voice: string): string {
  const source = (manual || voice || '').trim();
  if (!source) {
    return '';
  }

  const patterns = [
    /去(?<dest>[^\s，。,、“”"'、；;:!?]{1,12})/u,
    /到(?<dest>[^\s，。,、“”"'、；;:!?]{1,12})/u
  ];

  for (const regex of patterns) {
    const match = regex.exec(source);
    const candidate = match?.groups?.dest ?? null;
    if (candidate) {
      const sanitized = candidate.replace(/(旅游|旅行|玩|游|看看)$/u, '').trim();
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  }

  return '';
}
