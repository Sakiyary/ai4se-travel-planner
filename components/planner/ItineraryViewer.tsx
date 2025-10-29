"use client";

import { Box, Card, CardBody, CardHeader, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import type { ParsedItinerary } from '../../services/llm';
import { ItineraryMap, type MapActivityPoint } from './ItineraryMap';

interface ItineraryViewerProps {
  itinerary: ParsedItinerary | null;
}

function sanitizePoiId(poiId?: string | null) {
  if (typeof poiId !== 'string') {
    return null;
  }

  const trimmed = poiId.trim();
  return /^B0[0-9A-Z]{8}$/i.test(trimmed) ? trimmed : null;
}

export function ItineraryViewer({ itinerary }: ItineraryViewerProps) {
  const mapPoints = useMemo<MapActivityPoint[]>(() => {
    if (!itinerary) {
      return [];
    }

    const points: MapActivityPoint[] = [];

    itinerary.itinerary.forEach((day) => {
      day.activities.forEach((activity) => {
        points.push({
          day: day.day,
          title: activity.title,
          description: activity.description,
          poiId: sanitizePoiId(activity.poiId),
          city: activity.city ?? itinerary.destination ?? null
        });
      });
    });

    return points;
  }, [itinerary]);

  if (!itinerary) {
    return (
      <Box borderWidth="1px" borderStyle="dashed" borderColor="gray.300" p={6} rounded="lg" textAlign="center">
        <Heading size="sm" color="gray.600">
          行程规划将在生成后显示
        </Heading>
        <Text mt={2} fontSize="sm" color="gray.500">
          填写旅行需求并点击“生成行程”以查看每日行程与预算拆分。
        </Text>
      </Box>
    );
  }

  return (
    <Stack spacing={4}>
      <Card variant="outline">
        <CardHeader>
          <Heading size="md">行程地图</Heading>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              同行人数：{itinerary.partySize} 人
            </Text>
            <ItineraryMap destination={itinerary.destination ?? null} points={mapPoints} />
          </Stack>
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">预算概览</Heading>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
            <BudgetCell label="总预算" value={itinerary.budget.total} />
            {typeof itinerary.budget.transport === 'number' ? (
              <BudgetCell label="交通" value={itinerary.budget.transport} />
            ) : null}
            {typeof itinerary.budget.accommodation === 'number' ? (
              <BudgetCell label="住宿" value={itinerary.budget.accommodation} />
            ) : null}
            {typeof itinerary.budget.dining === 'number' ? (
              <BudgetCell label="餐饮" value={itinerary.budget.dining} />
            ) : null}
            {typeof itinerary.budget.activities === 'number' ? (
              <BudgetCell label="活动" value={itinerary.budget.activities} />
            ) : null}
            {typeof itinerary.budget.contingency === 'number' ? (
              <BudgetCell label="预留" value={itinerary.budget.contingency} />
            ) : null}
          </SimpleGrid>
        </CardBody>
      </Card>

      <Stack spacing={4}>
        {itinerary.itinerary.map((day) => (
          <Card key={day.day} variant="outline">
            <CardHeader>
              <Heading size="md">第 {day.day} 天</Heading>
              {day.summary ? (
                <Text fontSize="sm" mt={1} color="gray.600">
                  {day.summary}
                </Text>
              ) : null}
            </CardHeader>
            <CardBody>
              <Stack spacing={3}>
                {day.activities.map((activity, index) => (
                  <Box
                    key={`${day.day}-${index}-${activity.title}`}
                    borderLeftWidth="4px"
                    borderLeftColor="cyan.400"
                    pl={3}
                    py={1}
                    bg="gray.50"
                    rounded="md"
                  >
                    <Heading size="sm">{activity.title}</Heading>
                    <Text fontSize="sm" color="gray.600">
                      {formatTimeRange(activity.startTime, activity.endTime)}
                    </Text>
                    {activity.city ? (
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        城市：{activity.city}
                      </Text>
                    ) : null}
                    {activity.description ? (
                      <Text fontSize="sm" color="gray.700" mt={1}>
                        {activity.description}
                      </Text>
                    ) : null}
                    {activity.budget ? (
                      <Text fontSize="sm" color="gray.600" mt={1}>
                        预算：¥{activity.budget.toFixed(0)}
                      </Text>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </CardBody>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function BudgetCell({ label, value }: { label: string; value: number }) {
  return (
    <Box bg="gray.50" p={4} rounded="md" borderWidth="1px" borderColor="gray.200">
      <Text fontSize="sm" color="gray.500">
        {label}
      </Text>
      <Text fontWeight="bold" color="gray.800">
        ¥{value.toFixed(0)}
      </Text>
    </Box>
  );
}

function formatTimeRange(start?: string, end?: string) {
  if (!start && !end) return '时间待定';
  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? '';
}
