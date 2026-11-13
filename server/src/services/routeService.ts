import { query } from '../config/db';

export interface CanonicalZone {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export interface RouteFareResult {
  available: boolean;
  fare?: number;
  fromLocation?: string;
  toLocation?: string;
  fromZoneId?: number;
  toZoneId?: number;
  error?: string;
}

export interface FareRouteRecord {
  id: number;
  from_location: string;
  to_location: string;
  fare: number;
  is_active: boolean;
  updated_at: string;
  from_location_id?: number | null;
  to_location_id?: number | null;
}

export class RouteService {
  /**
   * Calculates distance in meters between two GPS coordinates using Haversine formula
   */
  public static calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Checks whether a point (longitude, latitude) is inside a polygon
   */
  public static isPointInsidePolygon(
    longitude: number,
    latitude: number,
    polygon: [number, number][]
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersects =
        yi > latitude !== yj > latitude &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * Resolves a place name, formatted address, or GPS coordinates to an approved canonical fare zone.
   * Prioritizes:
   * 1. Exact match with canonical zone name
   * 2. Exact match with an approved alias
   * 3. Normalized phrase / token boundary match on aliases (sorted longest-first)
   * 4. GPS polygon boundary match in fare_areas
   * 5. GPS distance proximity match to canonical zone center (within zone radius)
   * Returns null if unapproved/unconfigured.
   */
  public static async resolveCanonicalZone(
    placeNameOrAddress?: string | null,
    latitude?: number | null,
    longitude?: number | null
  ): Promise<CanonicalZone | null> {
    const rawText = (placeNameOrAddress || '').trim();
    const cleanText = rawText.toLowerCase();

    // Query canonical zones
    const locRes = await query<CanonicalZone>(
      `SELECT id, name, latitude, longitude, radius_meters FROM locations ORDER BY id ASC`
    );
    const zones = locRes.rows;

    // Query all aliases
    const aliasRes = await query<{ location_id: number; alias: string }>(
      `SELECT location_id, alias FROM location_aliases ORDER BY LENGTH(alias) DESC`
    );
    const aliases = aliasRes.rows;

    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const hasCoordinates = Number.isFinite(latNum) && Number.isFinite(lngNum);

    // 1. If GPS coordinates are provided, check spatial boundaries
    if (hasCoordinates) {
      // 1a. Check fare_areas polygon match
      try {
        const areaPolygons = await query<{
          id: number;
          name: string;
          boundary: any;
          location_id?: number | null;
        }>(
          `SELECT id, name, boundary, location_id FROM fare_areas WHERE is_active = TRUE ORDER BY id ASC`
        );

        for (const area of areaPolygons.rows) {
          const boundary =
            typeof area.boundary === 'string' ? JSON.parse(area.boundary) : area.boundary;
          if (Array.isArray(boundary) && RouteService.isPointInsidePolygon(lngNum, latNum, boundary)) {
            if (area.location_id) {
              const matched = zones.find(z => z.id === area.location_id);
              if (matched) return matched;
            }
            const nameMatch = aliases.find(
              a => a.alias.toLowerCase().trim() === area.name.toLowerCase().trim()
            );
            if (nameMatch) {
              const matched = zones.find(z => z.id === nameMatch.location_id);
              if (matched) return matched;
            }
          }
        }
      } catch (polyErr) {
        console.warn('[RouteService] Polygon check warning:', polyErr);
      }

      // 1b. Proximity to zone center within radius_meters
      let closestZone: CanonicalZone | null = null;
      let minDistance = Infinity;

      for (const zone of zones) {
        if (zone.latitude != null && zone.longitude != null) {
          const dist = RouteService.calculateDistanceMeters(
            latNum,
            lngNum,
            Number(zone.latitude),
            Number(zone.longitude)
          );
          const maxRadius = Number(zone.radius_meters) || 1200;
          if (dist <= maxRadius && dist < minDistance) {
            minDistance = dist;
            closestZone = zone;
          }
        }
      }

      if (closestZone) return closestZone;

      // 1c. If coordinates are provided but outside all zone radii, check if text matches an alias
      // AND coordinates are within extended tolerance (radius * 1.5)
      if (cleanText) {
        for (const zone of zones) {
          if (zone.latitude != null && zone.longitude != null) {
            const dist = RouteService.calculateDistanceMeters(
              latNum,
              lngNum,
              Number(zone.latitude),
              Number(zone.longitude)
            );
            const extendedRadius = (Number(zone.radius_meters) || 1200) * 1.5;
            if (dist <= extendedRadius) {
              if (zone.name.toLowerCase().trim() === cleanText) return zone;
              const hasMatchingAlias = aliases.some(
                a => a.location_id === zone.id && (
                  a.alias.toLowerCase().trim() === cleanText ||
                  cleanText.includes(a.alias.toLowerCase().trim())
                )
              );
              if (hasMatchingAlias) return zone;
            }
          }
        }
      }

      // Coordinates were explicitly provided but fall outside all approved boundaries
      return null;
    }

    // 2. Fallback to place name / alias matching when coordinates are not provided
    if (cleanText) {
      // 2a. Exact canonical name match
      const exactZone = zones.find(z => z.name.toLowerCase().trim() === cleanText);
      if (exactZone) return exactZone;

      // 2b. Exact alias match
      const exactAlias = aliases.find(a => a.alias.toLowerCase().trim() === cleanText);
      if (exactAlias) {
        const parent = zones.find(z => z.id === exactAlias.location_id);
        if (parent) return parent;
      }

      // 2c. Substring / Word-boundary match against aliases (longest first)
      for (const a of aliases) {
        const aText = a.alias.toLowerCase().trim();
        if (!aText) continue;

        // Escape regex special chars
        const escaped = aText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');

        if (wordRegex.test(cleanText) || cleanText.includes(aText)) {
          const parent = zones.find(z => z.id === a.location_id);
          if (parent) return parent;
        }
      }
    }

    return null;
  }

  /**
   * Returns list of selectable canonical locations in the system
   */
  public static async getLocations(): Promise<string[]> {
    const res = await query<{ name: string }>('SELECT name FROM locations ORDER BY id ASC');
    return res.rows.map(r => r.name);
  }

  /**
   * Returns all canonical zones with their aliases and coordinates
   */
  public static async getApprovedZones(): Promise<Array<{
    id: number;
    name: string;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number;
    aliases: string[];
  }>> {
    const locRes = await query<CanonicalZone>(
      `SELECT id, name, latitude, longitude, radius_meters FROM locations ORDER BY id ASC`
    );
    const aliasRes = await query<{ location_id: number; alias: string }>(
      `SELECT location_id, alias FROM location_aliases ORDER BY id ASC`
    );

    return locRes.rows.map(l => ({
      id: l.id,
      name: l.name,
      latitude: l.latitude != null ? Number(l.latitude) : null,
      longitude: l.longitude != null ? Number(l.longitude) : null,
      radius_meters: Number(l.radius_meters) || 1200,
      aliases: aliasRes.rows.filter(a => a.location_id === l.id).map(a => a.alias)
    }));
  }

  /**
   * Looks up fixed route fare from the database using canonical zone IDs.
   * If exact route is not found or is inactive, returns available: false.
   */
  public static async getRouteFare(
    fromLoc: string,
    toLoc: string,
    pickupLat?: number,
    pickupLng?: number,
    destLat?: number,
    destLng?: number
  ): Promise<RouteFareResult> {
    const fromClean = (fromLoc || '').trim();
    const toClean = (toLoc || '').trim();

    if (!fromClean || !toClean) {
      return {
        available: false,
        error: 'Please select both pickup and destination locations.'
      };
    }

    // Resolve both locations to canonical fare zones
    const fromZone = await this.resolveCanonicalZone(fromClean, pickupLat, pickupLng);
    const toZone = await this.resolveCanonicalZone(toClean, destLat, destLng);

    if (!fromZone || !toZone) {
      return {
        available: false,
        error: 'Fare not configured for this location'
      };
    }

    if (fromZone.id === toZone.id) {
      return {
        available: false,
        error: 'Pickup and destination cannot be the same location.'
      };
    }

    // Direct query in fare_routes using canonical zone IDs (with fallback to canonical names)
    const res = await query<{
      fare: number;
      from_location: string;
      to_location: string;
      from_location_id?: number;
      to_location_id?: number;
      is_active: boolean;
    }>(
      `SELECT fare, from_location, to_location, from_location_id, to_location_id, is_active
       FROM fare_routes
       WHERE is_active = TRUE
         AND (
           (from_location_id = $1 AND to_location_id = $2)
           OR (from_location_id = $2 AND to_location_id = $1)
           OR (LOWER(TRIM(from_location)) = LOWER($3) AND LOWER(TRIM(to_location)) = LOWER($4))
           OR (LOWER(TRIM(from_location)) = LOWER($4) AND LOWER(TRIM(to_location)) = LOWER($3))
         )
       LIMIT 1`,
      [fromZone.id, toZone.id, fromZone.name, toZone.name]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        available: true,
        fare: Number(row.fare),
        fromLocation: fromZone.name,
        toLocation: toZone.name,
        fromZoneId: fromZone.id,
        toZoneId: toZone.id
      };
    }

    return {
      available: false,
      fromLocation: fromZone.name,
      toLocation: toZone.name,
      error: 'Fare not configured for this route. Please contact the admin.'
    };
  }

  /**
   * Get all routes for Admin
   */
  public static async getAllFareRoutes(): Promise<FareRouteRecord[]> {
    const res = await query<FareRouteRecord>('SELECT * FROM fare_routes ORDER BY id ASC');
    return res.rows.map(r => ({
      ...r,
      fare: Number(r.fare),
      is_active: Boolean(r.is_active)
    }));
  }

  /**
   * Admin updates a route fare
   */
  public static async updateRouteFare(id: number, fare: number): Promise<FareRouteRecord> {
    const res = await query<FareRouteRecord>(
      `UPDATE fare_routes
       SET fare = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [fare, id]
    );
    if (res.rows.length === 0) {
      throw new Error('Fare route not found.');
    }
    return {
      ...res.rows[0],
      fare: Number(res.rows[0].fare),
      is_active: Boolean(res.rows[0].is_active)
    };
  }

  /**
   * Admin toggles a route active/inactive
   */
  public static async toggleRouteActive(id: number): Promise<FareRouteRecord> {
    const current = await query<{ is_active: boolean }>('SELECT is_active FROM fare_routes WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      throw new Error('Fare route not found.');
    }
    const newStatus = !current.rows[0].is_active;
    const res = await query<FareRouteRecord>(
      `UPDATE fare_routes SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
    return {
      ...res.rows[0],
      fare: Number(res.rows[0].fare),
      is_active: Boolean(res.rows[0].is_active)
    };
  }

  /**
   * Admin creates a new route
   */
  public static async addRoute(fromLocation: string, toLocation: string, fare: number): Promise<FareRouteRecord> {
    const fromClean = fromLocation.trim();
    const toClean = toLocation.trim();

    if (!fromClean || !toClean) {
      throw new Error('From and To locations are required.');
    }
    if (fare <= 0) {
      throw new Error('Fare must be greater than 0.');
    }

    // Ensure locations exist in locations table
    await query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [fromClean]);
    await query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [toClean]);

    const l1 = await query<{ id: number }>('SELECT id FROM locations WHERE LOWER(name) = LOWER($1) LIMIT 1', [fromClean]);
    const l2 = await query<{ id: number }>('SELECT id FROM locations WHERE LOWER(name) = LOWER($1) LIMIT 1', [toClean]);
    const fromId = l1.rows[0]?.id;
    const toId = l2.rows[0]?.id;

    const res = await query<FareRouteRecord>(
      `INSERT INTO fare_routes (from_location, to_location, fare, is_active, updated_at, from_location_id, to_location_id)
       VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, $4, $5)
       ON CONFLICT (from_location, to_location)
       DO UPDATE SET fare = EXCLUDED.fare, is_active = TRUE, updated_at = CURRENT_TIMESTAMP,
                     from_location_id = EXCLUDED.from_location_id, to_location_id = EXCLUDED.to_location_id
       RETURNING *`,
      [fromClean, toClean, fare, fromId, toId]
    );

    return {
      ...res.rows[0],
      fare: Number(res.rows[0].fare),
      is_active: Boolean(res.rows[0].is_active)
    };
  }
}
