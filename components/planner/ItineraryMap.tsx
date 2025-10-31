"use client";

import { Box, Spinner, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getRuntimeConfig } from '../../lib/runtimeConfig';

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

export interface MapActivityPoint {
  day: number;
  title: string;
  description?: string | null;
  poiId?: string | null;
  city?: string | null;
}

interface ResolvedActivityPoint extends MapActivityPoint {
  lng: number;
  lat: number;
  address?: string;
  adcode?: string | null;
}

interface ItineraryMapProps {
  destination?: string | null;
  points: MapActivityPoint[];
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error';

type JsApiPlaceSearch = {
  search: (
    keyword: string,
    callback: (status: 'complete' | 'no_data' | 'error', result: unknown) => void
  ) => void;
  setCity?: (city?: string) => void;
};

type JsApiGeocoder = {
  getLocation: (
    keyword: string,
    callback: (status: 'complete' | 'no_data' | 'error', result: unknown) => void
  ) => void;
  setCity?: (city?: string) => void;
};

function normalizeCityName(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/市|区|县|自治州|特别行政区$/u, '');
}

function buildCityCandidates(pointCity?: string | null, destination?: string | null) {
  const set = new Set<string>();
  const addValue = (raw?: string | null) => {
    if (!raw) {
      return;
    }

    raw
      .split(/[、，,/|\s]+/u)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => set.add(part));
  };

  addValue(pointCity);
  addValue(destination);

  return Array.from(set);
}

function shouldAcceptLocation(
  location: { city?: string | null; adcode?: string | null },
  expectedCities: string[]
) {
  if (expectedCities.length === 0) {
    return true;
  }

  const normalizedExpected = expectedCities
    .map((city) => normalizeCityName(city))
    .filter((city): city is string => Boolean(city));

  if (normalizedExpected.length === 0) {
    return true;
  }

  const normalizedLocation = normalizeCityName(location.city);
  if (normalizedLocation) {
    return normalizedExpected.some(
      (candidate) =>
        normalizedLocation.includes(candidate) || candidate.includes(normalizedLocation)
    );
  }

  // 没有城市信息时无法判断，保守接受
  return true;
}

async function geocodeAddress(address: string, apiKey: string, city?: string | null) {
  const params = new URLSearchParams({
    key: apiKey,
    address
  });

  if (city) {
    params.set('city', city);
  }

  const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to geocode address ${address}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    geocodes?: Array<{ location?: string; formatted_address?: string; adcode?: string; city?: string; district?: string }>;
  };

  if (payload.status !== '1' || !Array.isArray(payload.geocodes) || payload.geocodes.length === 0) {
    return null;
  }

  const [lng, lat] = (payload.geocodes[0]?.location ?? '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    lng,
    lat,
    address: payload.geocodes[0]?.formatted_address ?? undefined,
    city: payload.geocodes[0]?.city ?? payload.geocodes[0]?.district ?? undefined,
    adcode: payload.geocodes[0]?.adcode ?? undefined
  };
}

async function fetchPoiById(poiId: string, apiKey: string) {
  const params = new URLSearchParams({
    id: poiId,
    key: apiKey
  });

  const response = await fetch(`https://restapi.amap.com/v3/place/detail?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch poi detail for ${poiId}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    pois?: Array<{
      location?: string;
      name?: string;
      address?: string;
      cityname?: string;
      adname?: string;
      adcode?: string;
    }>;
  };

  if (payload.status !== '1' || !Array.isArray(payload.pois) || payload.pois.length === 0) {
    return null;
  }

  const [lng, lat] = (payload.pois[0]?.location ?? '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    lng,
    lat,
    address: payload.pois[0]?.address ?? undefined,
    city: payload.pois[0]?.cityname ?? payload.pois[0]?.adname ?? undefined,
    adcode: payload.pois[0]?.adcode ?? undefined
  };
}

async function searchPoiByKeyword(keyword: string, apiKey: string, city?: string | null) {
  const params = new URLSearchParams({
    key: apiKey,
    keywords: keyword,
    offset: '1'
  });

  if (city) {
    params.set('city', city);
    params.set('citylimit', 'true');
  }

  const response = await fetch(`https://restapi.amap.com/v3/place/text?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to search place for ${keyword}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    pois?: Array<{
      location?: string;
      name?: string;
      address?: string;
      cityname?: string;
      adname?: string;
      adcode?: string;
    }>;
  };

  if (payload.status !== '1' || !Array.isArray(payload.pois) || payload.pois.length === 0) {
    return null;
  }

  const [lng, lat] = (payload.pois[0]?.location ?? '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    lng,
    lat,
    address: payload.pois[0]?.address ?? undefined,
    city: payload.pois[0]?.cityname ?? payload.pois[0]?.adname ?? undefined,
    adcode: payload.pois[0]?.adcode ?? undefined
  };
}

async function resolveLocationForPoint(
  point: MapActivityPoint,
  destination: string | null | undefined,
  apiKey: string,
  placeSearch?: JsApiPlaceSearch | null,
  geocoder?: JsApiGeocoder | null
): Promise<{ lng: number; lat: number; address?: string; city?: string | null; adcode?: string | null } | null> {
  const cityCandidates = buildCityCandidates(point.city, destination);
  const primaryCity = cityCandidates[0] ?? null;

  if (point.poiId) {
    const byId = await fetchPoiById(point.poiId, apiKey).catch(() => null);
    if (byId && shouldAcceptLocation(byId, cityCandidates)) {
      return byId;
    }

    if (byId) {
      console.warn('[ItineraryMap] POI city mismatch (detail)', {
        poiId: point.poiId,
        expected: cityCandidates,
        resolvedCity: byId.city,
        resolvedAdcode: byId.adcode
      });
    }
  }

  const keywordCandidates = new Set<string>();

  if (point.poiId) {
    keywordCandidates.add(point.poiId);
    if (destination) {
      keywordCandidates.add(`${destination} ${point.poiId}`);
    }
  }

  if (point.title) {
    keywordCandidates.add(point.title);
    if (destination) {
      keywordCandidates.add(`${destination} ${point.title}`);
    }
  }

  if (point.description) {
    const trimmed = point.description.trim();
    if (trimmed) {
      keywordCandidates.add(trimmed.slice(0, 48));
      if (destination) {
        keywordCandidates.add(`${destination} ${trimmed.slice(0, 48)}`);
      }
    }
  }

  for (const keyword of keywordCandidates) {
    if (!keyword) {
      continue;
    }

    if (placeSearch) {
      if (primaryCity && placeSearch.setCity) {
        placeSearch.setCity(primaryCity);
      }
      const jsResult = await searchWithJsApi(placeSearch, keyword).catch(() => null);
      if (jsResult && shouldAcceptLocation(jsResult, cityCandidates)) {
        return jsResult;
      }

      if (jsResult) {
        console.warn('[ItineraryMap] POI city mismatch (JS API search)', {
          keyword,
          expected: cityCandidates,
          resolvedCity: jsResult.city,
          resolvedAdcode: jsResult.adcode
        });
      }
    }

    const restResult = await searchPoiByKeyword(keyword, apiKey, primaryCity).catch(() => null);
    if (restResult && shouldAcceptLocation(restResult, cityCandidates)) {
      return restResult;
    }

    if (restResult) {
      console.warn('[ItineraryMap] POI city mismatch (REST search)', {
        keyword,
        expected: cityCandidates,
        resolvedCity: restResult.city,
        resolvedAdcode: restResult.adcode
      });
    }
  }

  if (point.poiId) {
    const geocodeKeyword = destination ? `${destination} ${point.poiId}` : point.poiId;
    if (geocoder && primaryCity && geocoder.setCity) {
      geocoder.setCity(primaryCity);
    }

    let geocoded = geocoder ? await geocodeWithJsApi(geocoder, geocodeKeyword).catch(() => null) : null;
    if (!geocoded || !shouldAcceptLocation(geocoded, cityCandidates)) {
      geocoded = await geocodeAddress(geocodeKeyword, apiKey, primaryCity).catch(() => null);
    }
    if (geocoded && shouldAcceptLocation(geocoded, cityCandidates)) {
      return geocoded;
    }

    if (geocoded) {
      console.warn('[ItineraryMap] POI city mismatch (geocode by poiId)', {
        keyword: geocodeKeyword,
        expected: cityCandidates,
        resolvedCity: geocoded.city,
        resolvedAdcode: geocoded.adcode
      });
    }
  }

  if (point.title) {
    const geocodeKeyword = destination ? `${destination} ${point.title}` : point.title;
    if (geocoder && primaryCity && geocoder.setCity) {
      geocoder.setCity(primaryCity);
    }

    let geocoded = geocoder ? await geocodeWithJsApi(geocoder, geocodeKeyword).catch(() => null) : null;
    if (!geocoded || !shouldAcceptLocation(geocoded, cityCandidates)) {
      geocoded = await geocodeAddress(geocodeKeyword, apiKey, primaryCity).catch(() => null);
    }
    if (geocoded && shouldAcceptLocation(geocoded, cityCandidates)) {
      return geocoded;
    }

    if (geocoded) {
      console.warn('[ItineraryMap] POI city mismatch (geocode by title)', {
        keyword: geocodeKeyword,
        expected: cityCandidates,
        resolvedCity: geocoded.city,
        resolvedAdcode: geocoded.adcode
      });
    }
  }

  return null;
}

function searchWithJsApi(placeSearch: JsApiPlaceSearch, keyword: string) {
  return new Promise<{ lng: number; lat: number; address?: string; city?: string | null; adcode?: string | null } | null>((resolve) => {
    placeSearch.search(keyword, (status, result) => {
      if (status === 'complete' && (result as { poiList?: { pois?: unknown[] } }).poiList?.pois?.length) {
        const typedResult = result as {
          poiList?: {
            pois?: Array<{
              location?: AMap.LngLat;
              address?: string;
              name?: string;
              cityname?: string;
              adcode?: string;
            }>;
          };
        };
        const firstPoi = typedResult.poiList?.pois?.[0];
        const location = firstPoi?.location;
        if (location) {
          resolve({
            lng: location.getLng(),
            lat: location.getLat(),
            address: firstPoi?.address || firstPoi?.name,
            city: firstPoi?.cityname ?? null,
            adcode: firstPoi?.adcode ?? null
          });
          return;
        }
      }
      resolve(null);
    });
  });
}

function geocodeWithJsApi(geocoder: JsApiGeocoder, keyword: string) {
  return new Promise<{ lng: number; lat: number; address?: string; city?: string | null; adcode?: string | null } | null>((resolve) => {
    geocoder.getLocation(keyword, (status, result) => {
      if (status === 'complete' && (result as { geocodes?: unknown[] }).geocodes?.length) {
        const typedResult = result as {
          geocodes?: Array<{
            location?: AMap.LngLat;
            formattedAddress?: string;
            adcode?: string;
            city?: string;
            district?: string;
          }>;
        };
        const first = typedResult.geocodes?.[0];
        const location = first?.location;
        if (location) {
          resolve({
            lng: location.getLng(),
            lat: location.getLat(),
            address: first?.formattedAddress,
            city: first?.city ?? first?.district ?? null,
            adcode: first?.adcode ?? null
          });
          return;
        }
      }
      resolve(null);
    });
  });
}

export function ItineraryMap({ destination, points }: ItineraryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<AMap.Map | null>(null);
  const amapRef = useRef<typeof window.AMap | null>(null);
  const markersRef = useRef<AMap.Marker[]>([]);
  const cacheRef = useRef<Map<string, ResolvedActivityPoint>>(new Map());
  const isLoadingRef = useRef(false);
  const placeSearchRef = useRef<JsApiPlaceSearch | null>(null);
  const geocoderRef = useRef<JsApiGeocoder | null>(null);

  const [status, setStatus] = useState<MapStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedPoints, setResolvedPoints] = useState<ResolvedActivityPoint[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const amapKey = useMemo(() => getRuntimeConfig().amapWebKey ?? '', []);
  const amapSecurityCode = useMemo(() => getRuntimeConfig().amapSecurityJsCode ?? '', []);

  const normalizedPoints = useMemo(() => {
    const unique = new Map<string, MapActivityPoint>();

    points.forEach((point) => {
      if (!point.title?.trim()) {
        return;
      }

      const key = point.poiId ?? `${point.title}-${point.city ?? ''}-${point.day}`;
      if (!unique.has(key)) {
        unique.set(key, point);
      }
    });

    return Array.from(unique.values());
  }, [points]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!containerRef.current) {
      return;
    }

    if (!amapKey) {
      setErrorMessage('缺少高德地图 Key，请在环境变量中配置 AMAP_WEB_KEY。');
      setStatus('error');
      return;
    }

    if (mapInstanceRef.current || isLoadingRef.current) {
      return;
    }

    let disposed = false;
    isLoadingRef.current = true;
    setStatus('loading');

    async function loadMap() {
      try {
        if (amapSecurityCode) {
          window._AMapSecurityConfig = { securityJsCode: amapSecurityCode };
        }

        const { default: AMapLoader } = await import('@amap/amap-jsapi-loader');
        const AMap = await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.PlaceSearch', 'AMap.Geocoder']
        });

        if (disposed) {
          return;
        }

        amapRef.current = AMap;
        const mapInstance = new AMap.Map(containerRef.current, {
          zoom: 11,
          viewMode: '3D',
          resizeEnable: true
        });

        mapInstance.addControl(new AMap.Scale());
        mapInstance.addControl(new AMap.ToolBar());
        mapInstanceRef.current = mapInstance;

        const AMapConstructors = AMap as unknown as {
          PlaceSearch: new (options: { pageSize: number; city?: string; citylimit?: boolean }) => JsApiPlaceSearch;
          Geocoder: new (options: { city?: string }) => JsApiGeocoder;
        };

        placeSearchRef.current = new AMapConstructors.PlaceSearch({
          pageSize: 1,
          citylimit: false
        });

        geocoderRef.current = new AMapConstructors.Geocoder({});

        setStatus('ready');
      } catch (error) {
        console.error('Failed to load AMap JS API', error);
        if (!disposed) {
          setErrorMessage('加载高德地图失败，请稍后重试。');
          setStatus('error');
        }
      } finally {
        if (!disposed) {
          isLoadingRef.current = false;
        }
      }
    }

    loadMap();

    return () => {
      disposed = true;
      isLoadingRef.current = false;

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [amapKey, amapSecurityCode]);

  useEffect(() => {
    if (destination === undefined) {
      return;
    }

    if (placeSearchRef.current?.setCity) {
      placeSearchRef.current.setCity(destination ?? undefined);
    }

    if (geocoderRef.current?.setCity) {
      geocoderRef.current.setCity(destination ?? undefined);
    }
  }, [destination]);

  useEffect(() => {
    let cancel = false;

    async function resolvePoints() {
      if (status !== 'ready' || !amapKey) {
        return;
      }

      if (normalizedPoints.length === 0) {
        setResolvedPoints([]);
        return;
      }

      const resolved: ResolvedActivityPoint[] = [];

      for (const point of normalizedPoints) {
        const cacheKey = point.poiId ?? point.title;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          resolved.push(cached);
          continue;
        }

        try {
          const location = await resolveLocationForPoint(
            point,
            destination,
            amapKey,
            placeSearchRef.current,
            geocoderRef.current
          );

          if (location) {
            const resolvedPoint: ResolvedActivityPoint = {
              ...point,
              lng: location.lng,
              lat: location.lat,
              city: point.city ?? location.city ?? null,
              address: location.address,
              adcode: location.adcode ?? null
            };
            cacheRef.current.set(cacheKey, resolvedPoint);
            resolved.push(resolvedPoint);
          }
        } catch (error) {
          console.warn('Failed to resolve location for', point.title, error);
        }

        if (cancel) {
          return;
        }
      }

      if (cancel) {
        return;
      }

      if (resolved.length === 0 && destination?.trim()) {
        try {
          const fallback = await geocodeAddress(destination.trim(), amapKey);
          if (fallback) {
            const fallbackPoint: ResolvedActivityPoint = {
              day: 1,
              title: destination.trim(),
              description: '目的地位置',
              poiId: null,
              lng: fallback.lng,
              lat: fallback.lat,
              city: fallback.city ?? destination.trim(),
              address: fallback.address,
              adcode: fallback.adcode ?? null
            };
            setFallbackNotice('未找到具体活动地点，已定位至目的地中心。');
            setResolvedPoints([fallbackPoint]);
            return;
          }
        } catch (error) {
          console.warn('Failed to geocode destination', destination, error);
        }
      }

      setFallbackNotice(null);
      setResolvedPoints(resolved);
    }

    resolvePoints();

    return () => {
      cancel = true;
    };
  }, [normalizedPoints, destination, status, amapKey]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const AMap = amapRef.current;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!map || !AMap || resolvedPoints.length === 0) {
      return;
    }

    const infoWindow = new AMap.InfoWindow({
      offset: new AMap.Pixel(0, -28)
    });

    const markers = resolvedPoints.map((point) => {
      const marker = new AMap.Marker({
        position: [point.lng, point.lat],
        map,
        title: point.title,
        label: {
          content: `第${point.day}天`,
          direction: 'top',
          offset: new AMap.Pixel(-20, -30)
        }
      });

      marker.on('click', () => {
        const content = `
          <div style="min-width:180px;">
            <strong>${point.title}</strong><br/>
            ${point.city ? `<span>${point.city}</span><br/>` : ''}
            ${point.address ? `<span>${point.address}</span><br/>` : ''}
            ${point.description ?? ''}
          </div>
        `;
        infoWindow.setContent(content);
        const position = marker.getPosition();
        if (position) {
          infoWindow.open(map, [position.getLng(), position.getLat()]);
        }
      });

      return marker;
    });

    markersRef.current = markers;

    if (markers.length === 1) {
      map.setZoom(14);
      map.setCenter(markers[0].getPosition()!);
    } else {
      map.setFitView(markers);
    }

    return () => {
      infoWindow.close();
    };
  }, [resolvedPoints]);

  return (
    <Box position="relative" w="100%" h="360px" rounded="lg" borderWidth="1px" borderColor="gray.200" overflow="hidden">
      <Box ref={containerRef} position="absolute" inset={0} />

      {status === 'loading' ? (
        <Stack
          position="absolute"
          inset={0}
          align="center"
          justify="center"
          bg="whiteAlpha.80"
          spacing={2}
        >
          <Spinner size="sm" color="cyan.500" />
          <Text fontSize="sm" color="gray.600">
            正在加载地图…
          </Text>
        </Stack>
      ) : null}

      {status === 'error' ? (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="red.50"
          px={6}
          textAlign="center"
        >
          <Text fontSize="sm" color="red.600">
            {errorMessage ?? '地图加载失败。'}
          </Text>
        </Box>
      ) : null}

      {status === 'ready' && resolvedPoints.length === 0 ? (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="whiteAlpha.80"
          px={6}
          textAlign="center"
        >
          <Text fontSize="sm" color="gray.600">
            未找到可用于定位的行程活动，将在包含地点信息时自动显示地图。
          </Text>
        </Box>
      ) : null}

      {fallbackNotice ? (
        <Box position="absolute" top={3} left={3} bg="white" px={3} py={1.5} rounded="md" shadow="sm" borderWidth="1px" borderColor="gray.200">
          <Text fontSize="xs" color="gray.600">
            {fallbackNotice}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
