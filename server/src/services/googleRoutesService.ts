export interface RouteDistanceResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds?: number;
}

export type MockDistanceHandler = (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
) => Promise<RouteDistanceResult | null> | RouteDistanceResult | null;

export class GoogleRoutesService {
  private static mockHandler: MockDistanceHandler | null = null;

  /**
   * For testing: allows tests to mock Google Routes API responses deterministically
   */
  public static setMockHandler(handler: MockDistanceHandler | null) {
    this.mockHandler = handler;
  }

  /**
   * Fetches actual driving road distance between two GPS coordinates using Google Routes API
   * (directions/v2:computeRoutes).
   *
   * Strictly uses actual road distance, never straight-line distance.
   * If Google Routes API fails, network error occurs, or no routes are found, returns null.
   */
  public static async getRoadDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteDistanceResult | null> {
    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      return null;
    }

    // 1. Check for test mock handler
    if (this.mockHandler) {
      return await this.mockHandler(originLat, originLng, destLat, destLng);
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

    if (!apiKey) {
      console.warn('[GoogleRoutesService] GOOGLE_MAPS_API_KEY is not configured.');
      return null;
    }

    const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const payload = {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLng
          }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE'
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(
          `[GoogleRoutesService] Routes API returned status ${response.status}: ${errorText.substring(0, 150)}`
        );
        return null;
      }

      const data: any = await response.json();

      if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
        console.warn('[GoogleRoutesService] No routes returned by Google Routes API.');
        return null;
      }

      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distanceMeters;

      if (typeof distanceMeters !== 'number' || distanceMeters < 0) {
        console.warn('[GoogleRoutesService] Invalid distanceMeters received:', distanceMeters);
        return null;
      }

      let durationSeconds: number | undefined;
      if (typeof primaryRoute.duration === 'string') {
        const match = primaryRoute.duration.match(/^(\d+(?:\.\d+)?)s$/);
        if (match) {
          durationSeconds = Math.round(parseFloat(match[1]));
        }
      }

      const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

      return {
        distanceMeters,
        distanceKm,
        durationSeconds
      };
    } catch (err: any) {
      console.warn('[GoogleRoutesService] Network or parsing error while querying Routes API:', err.message);
      return null;
    }
  }
}
