import { query } from '../config/db';

export interface RouteFareResult {
  available: boolean;
  fare?: number;
  fromLocation?: string;
  toLocation?: string;
  error?: string;
}

export interface FareRouteRecord {
  id: number;
  from_location: string;
  to_location: string;
  fare: number;
  is_active: boolean;
  updated_at: string;
}

export class RouteService {
  /**
   * Returns list of selectable locations in the system
   */
  public static async getLocations(): Promise<string[]> {
    const res = await query<{ name: string }>('SELECT name FROM locations ORDER BY id ASC');
    return res.rows.map(r => r.name);
  }

  /**
   * Looks up fixed route fare from the database table.
   * If exact route is not found or is inactive, returns available: false with the requested exact message.
   */
  public static async getRouteFare(fromLoc: string, toLoc: string): Promise<RouteFareResult> {
    const fromClean = (fromLoc || '').trim();
    const toClean = (toLoc || '').trim();

    if (!fromClean || !toClean) {
      return {
        available: false,
        error: 'Please select both pickup and destination locations.'
      };
    }

    if (fromClean.toLowerCase() === toClean.toLowerCase()) {
      return {
        available: false,
        error: 'Pickup and destination cannot be the same location.'
      };
    }

    const res = await query<{ fare: number; from_location: string; to_location: string; is_active: boolean }>(
      `SELECT fare, from_location, to_location, is_active
       FROM fare_routes 
       WHERE LOWER(TRIM(from_location)) = LOWER(TRIM($1)) 
         AND LOWER(TRIM(to_location)) = LOWER(TRIM($2))
         AND is_active = TRUE
       LIMIT 1`,
      [fromClean, toClean]
    );

    if (res.rows.length === 0) {
      return {
        available: false,
        error: 'Sorry, this route is currently unavailable.'
      };
    }

    const row = res.rows[0];
    return {
      available: true,
      fare: Number(row.fare),
      fromLocation: row.from_location,
      toLocation: row.to_location
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

    const res = await query<FareRouteRecord>(
      `INSERT INTO fare_routes (from_location, to_location, fare, is_active, updated_at)
       VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (from_location, to_location) 
       DO UPDATE SET fare = EXCLUDED.fare, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [fromClean, toClean, fare]
    );

    return {
      ...res.rows[0],
      fare: Number(res.rows[0].fare),
      is_active: Boolean(res.rows[0].is_active)
    };
  }
}
