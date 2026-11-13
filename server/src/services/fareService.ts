import { query } from '../config/db';
import { RouteService, RouteFareResult, FareRouteRecord } from './routeService';
import { GoogleRoutesService } from './googleRoutesService';
import { PlatformSettingsService } from './platformSettingsService';

interface FareArea {
  id: number;
  name: string;
  boundary: [number, number][];
  is_active: boolean;
}

export class FareService {
  /**
   * Checks whether a GPS coordinate is inside a polygon.
   * Coordinates are stored as: [longitude, latitude]
   */
  private static isPointInsidePolygon(
    longitude: number,
    latitude: number,
    polygon: [number, number][]
  ): boolean {
    let inside = false;

    for (
      let i = 0, j = polygon.length - 1;
      i < polygon.length;
      j = i++
    ) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersects =
        yi > latitude !== yj > latitude &&
        longitude <
          ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Finds which fare zone contains the given GPS coordinate.
   */
  private static async findAreaByCoordinates(
    latitude: number,
    longitude: number
  ): Promise<FareArea | null> {
    const result = await query<FareArea>(
      `SELECT id, name, boundary, is_active
       FROM fare_areas
       WHERE is_active = TRUE
       ORDER BY id ASC`
    );

    for (const area of result.rows) {
      const boundary =
        typeof area.boundary === 'string'
          ? JSON.parse(area.boundary)
          : area.boundary;

      if (
        Array.isArray(boundary) &&
        this.isPointInsidePolygon(
          longitude,
          latitude,
          boundary
        )
      ) {
        return {
          ...area,
          boundary
        };
      }
    }

    return null;
  }

  /**
   * Calculates fare using the Hybrid Fare System:
   *
   * 1. Priority 1: Check admin-configured fixed route fare first (via RouteService & area_fares).
   *    If a fixed fare exists, returns that exact configured fare immediately (no rounding/distance calc).
   * 2. Rejection: If pickup and destination resolve to the same location/zone, rejects immediately.
   * 3. Priority 2: When no fixed fare exists, falls back to automatic distance-based fare:
   *    - Checks if auto fares are enabled in platform_settings (rejects if disabled).
   *    - Queries actual road distance via Google Routes API (computeRoutes).
   *    - Rejects if road distance exceeds maximum allowed distance (default: 15 km).
   *    - Computes raw fare: baseFare + (distanceInKm * perKmRate).
   *    - Rounds to nearest increment: Math.round(rawFare / roundingIncrement) * roundingIncrement.
   */
  public static async calculateFare(
    fromLocation: string,
    toLocation: string,
    pickupLatitude?: number,
    pickupLongitude?: number,
    destinationLatitude?: number,
    destinationLongitude?: number
  ): Promise<RouteFareResult> {
    const cleanFrom = (fromLocation || '').trim();
    const cleanTo = (toLocation || '').trim();

    if (!cleanFrom || !cleanTo) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: 'Please select both pickup and destination locations.'
      };
    }

    if (cleanFrom.toLowerCase() === cleanTo.toLowerCase()) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: 'Pickup and destination cannot be the same location.'
      };
    }

    // 1. Check fixed route in database first (fare_routes and area_fares via RouteService)
    const routeFare = await RouteService.getRouteFare(
      cleanFrom,
      cleanTo,
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude
    );

    // If exact fixed fare found, return immediately without applying distance calculation or rounding
    if (routeFare.available && routeFare.fare !== undefined) {
      return {
        ...routeFare,
        fareSource: 'fixed',
        isAutoFare: false
      };
    }

    // Propagate same-location rejection if canonical zones resolved to the same entity
    if (routeFare.error === 'Pickup and destination cannot be the same location.') {
      return {
        available: false,
        fromLocation: routeFare.fromLocation || cleanFrom,
        toLocation: routeFare.toLocation || cleanTo,
        error: 'Pickup and destination cannot be the same location.'
      };
    }

    // Check GPS polygon area_fares if coordinates are provided
    const hasCoordinates =
      Number.isFinite(pickupLatitude) &&
      Number.isFinite(pickupLongitude) &&
      Number.isFinite(destinationLatitude) &&
      Number.isFinite(destinationLongitude);

    if (hasCoordinates) {
      const pickupArea = await this.findAreaByCoordinates(
        pickupLatitude!,
        pickupLongitude!
      );

      const destinationArea = await this.findAreaByCoordinates(
        destinationLatitude!,
        destinationLongitude!
      );

      if (pickupArea && destinationArea) {
        if (pickupArea.id === destinationArea.id) {
          return {
            available: false,
            fromLocation: pickupArea.name,
            toLocation: destinationArea.name,
            error: 'Pickup and destination cannot be the same location.'
          };
        }

        let fareResult = await query<{ fare: number }>(
          `SELECT fare
           FROM area_fares
           WHERE pickup_area_id = $1
             AND destination_area_id = $2
             AND is_active = TRUE
           LIMIT 1`,
          [pickupArea.id, destinationArea.id]
        );

        if (fareResult.rows.length === 0) {
          fareResult = await query<{ fare: number }>(
            `SELECT fare
             FROM area_fares
             WHERE pickup_area_id = $2
               AND destination_area_id = $1
               AND is_active = TRUE
             LIMIT 1`,
            [pickupArea.id, destinationArea.id]
          );
        }

        if (fareResult.rows.length > 0) {
          return {
            available: true,
            fromLocation: pickupArea.name,
            toLocation: destinationArea.name,
            fare: Number(fareResult.rows[0].fare),
            fareSource: 'fixed',
            isAutoFare: false
          };
        }
      }
    }

    // 2. Fallback: Automatic Distance-Based Fare Calculation
    const settings = await PlatformSettingsService.getAutoFareSettings();

    // If automatic fares are disabled, reject routes without a fixed fare
    if (!settings.autoFareEnabled) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: 'Fare not configured for this location'
      };
    }

    // Coordinates are strictly required for automatic road distance calculation
    if (!hasCoordinates) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: 'Pickup and destination GPS locations are required.'
      };
    }

    // 3. Query Google Routes API for actual road distance (never estimate straight-line)
    const distanceResult = await GoogleRoutesService.getRoadDistance(
      pickupLatitude!,
      pickupLongitude!,
      destinationLatitude!,
      destinationLongitude!
    );

    if (!distanceResult) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: 'Unable to calculate route distance. Please try again or select an approved location.'
      };
    }

    const roadDistanceInKm = distanceResult.distanceKm;

    // Reject automatic-fare bookings above maximum distance limit (default 15 km)
    if (roadDistanceInKm > settings.maxDistanceKm) {
      return {
        available: false,
        fromLocation: cleanFrom,
        toLocation: cleanTo,
        error: `Distance exceeds maximum automatic booking limit of ${settings.maxDistanceKm} km.`
      };
    }

    // 4. Automatic Fare Formula:
    // rawFare = baseFare + (roadDistanceInKm * perKmRate)
    // roundedFare = Math.round(rawFare / roundingIncrement) * roundingIncrement
    const rawFare = settings.baseFare + roadDistanceInKm * settings.perKmRate;
    const finalFare = Math.round(rawFare / settings.roundingIncrement) * settings.roundingIncrement;

    return {
      available: true,
      fromLocation: cleanFrom,
      toLocation: cleanTo,
      fare: finalFare,
      rawFare: Math.round(rawFare * 100) / 100,
      distanceKm: roadDistanceInKm,
      durationSeconds: distanceResult.durationSeconds,
      fareSource: 'distance',
      isAutoFare: true
    };
  }

  public static async getAllFareRoutes(): Promise<FareRouteRecord[]> {
    return RouteService.getAllFareRoutes();
  }

  public static async updateRouteFare(
    id: number,
    fare: number
  ): Promise<FareRouteRecord> {
    return RouteService.updateRouteFare(id, fare);
  }
}
