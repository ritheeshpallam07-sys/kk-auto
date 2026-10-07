import { query } from '../config/db';
import { RouteService, RouteFareResult, FareRouteRecord } from './routeService';

interface FareArea {
  id: number;
  name: string;
  boundary: [number, number][];
  is_active: boolean;
}

export class FareService {
  /**
   * Checks whether a GPS coordinate is inside a polygon.
   *
   * Coordinates are stored as:
   * [longitude, latitude]
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
   * Calculates fare using:
   *
   * Exact pickup GPS
   *       ↓
   * Pickup fare zone
   *       ↓
   * Exact destination GPS
   *       ↓
   * Destination fare zone
   *       ↓
   * Admin-configured zone-to-zone fare
   */
  public static async calculateFare(
    fromLocation: string,
    toLocation: string,
    pickupLatitude?: number,
    pickupLongitude?: number,
    destinationLatitude?: number,
    destinationLongitude?: number
  ): Promise<RouteFareResult> {
    if (
      pickupLatitude === undefined ||
      pickupLongitude === undefined ||
      destinationLatitude === undefined ||
      destinationLongitude === undefined
    ) {
      return {
        available: false,
        fromLocation,
        toLocation,
        error: 'Pickup and destination GPS locations are required.'
      };
    }

    if (
      !Number.isFinite(pickupLatitude) ||
      !Number.isFinite(pickupLongitude) ||
      !Number.isFinite(destinationLatitude) ||
      !Number.isFinite(destinationLongitude)
    ) {
      return {
        available: false,
        fromLocation,
        toLocation,
        error: 'Invalid GPS coordinates.'
      };
    }

    const pickupArea = await this.findAreaByCoordinates(
      pickupLatitude,
      pickupLongitude
    );

    if (!pickupArea) {
      return {
        available: false,
        fromLocation,
        toLocation,
        error: 'Pickup location is outside our service areas.'
      };
    }

    const destinationArea = await this.findAreaByCoordinates(
      destinationLatitude,
      destinationLongitude
    );

    if (!destinationArea) {
      return {
        available: false,
        fromLocation,
        toLocation,
        error: 'Destination location is outside our service areas.'
      };
    }

    if (pickupArea.id === destinationArea.id) {
      return {
        available: false,
        fromLocation: pickupArea.name,
        toLocation: destinationArea.name,
        error: 'Pickup and destination are inside the same fare area.'
      };
    }

    const fareResult = await query<{ fare: number }>(
      `SELECT fare
       FROM area_fares
       WHERE pickup_area_id = $1
         AND destination_area_id = $2
         AND is_active = TRUE
       LIMIT 1`,
      [pickupArea.id, destinationArea.id]
    );

    if (fareResult.rows.length === 0) {
      return {
        available: false,
        fromLocation: pickupArea.name,
        toLocation: destinationArea.name,
        error: 'Fare is not configured for this route yet.'
      };
    }

    return {
      available: true,
      fromLocation: pickupArea.name,
      toLocation: destinationArea.name,
      fare: Number(fareResult.rows[0].fare)
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