import { query } from '../config/db';

export interface AutoFareSettings {
  autoFareEnabled: boolean;
  baseFare: number;
  perKmRate: number;
  maxDistanceKm: number;
  roundingIncrement: number;
}

export class PlatformSettingsService {
  public static readonly DEFAULT_SETTINGS: AutoFareSettings = {
    autoFareEnabled: true,
    baseFare: 10.0,
    perKmRate: 15.0,
    maxDistanceKm: 15.0,
    roundingIncrement: 10.0
  };

  /**
   * Retrieves current automatic fare settings directly from platform_settings table.
   * Guarantees fresh data so admin changes take effect immediately without code deployment.
   */
  public static async getAutoFareSettings(): Promise<AutoFareSettings> {
    try {
      const res = await query<{ key: string; value: string }>(
        `SELECT key, value FROM platform_settings
         WHERE key IN (
           'auto_fare_enabled',
           'auto_fare_base',
           'auto_fare_per_km',
           'auto_fare_max_distance_km',
           'auto_fare_rounding_increment'
         )`
      );

      const map = new Map<string, string>();
      for (const row of res.rows) {
        map.set(row.key, row.value);
      }

      const enabledRaw = map.get('auto_fare_enabled');
      const baseRaw = map.get('auto_fare_base');
      const perKmRaw = map.get('auto_fare_per_km');
      const maxDistRaw = map.get('auto_fare_max_distance_km');
      const roundingRaw = map.get('auto_fare_rounding_increment');

      return {
        autoFareEnabled:
          enabledRaw !== undefined
            ? enabledRaw === 'true' || enabledRaw === '1'
            : this.DEFAULT_SETTINGS.autoFareEnabled,
        baseFare:
          baseRaw !== undefined && !isNaN(parseFloat(baseRaw))
            ? parseFloat(baseRaw)
            : this.DEFAULT_SETTINGS.baseFare,
        perKmRate:
          perKmRaw !== undefined && !isNaN(parseFloat(perKmRaw))
            ? parseFloat(perKmRaw)
            : this.DEFAULT_SETTINGS.perKmRate,
        maxDistanceKm:
          maxDistRaw !== undefined && !isNaN(parseFloat(maxDistRaw))
            ? parseFloat(maxDistRaw)
            : this.DEFAULT_SETTINGS.maxDistanceKm,
        roundingIncrement:
          roundingRaw !== undefined && !isNaN(parseFloat(roundingRaw))
            ? parseFloat(roundingRaw)
            : this.DEFAULT_SETTINGS.roundingIncrement
      };
    } catch (err: any) {
      console.warn('[PlatformSettingsService] Failed to fetch auto fare settings, using defaults:', err.message);
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  /**
   * Updates automatic fare settings in platform_settings table with strict input validation.
   */
  public static async updateAutoFareSettings(
    updates: Partial<AutoFareSettings>
  ): Promise<AutoFareSettings> {
    if (updates.baseFare !== undefined) {
      const val = Number(updates.baseFare);
      if (isNaN(val) || val < 0) {
        throw new Error('Base fare must be a non-negative number.');
      }
    }

    if (updates.perKmRate !== undefined) {
      const val = Number(updates.perKmRate);
      if (isNaN(val) || val <= 0) {
        throw new Error('Per-kilometre rate must be greater than zero.');
      }
    }

    if (updates.maxDistanceKm !== undefined) {
      const val = Number(updates.maxDistanceKm);
      if (isNaN(val) || val <= 0) {
        throw new Error('Maximum distance must be greater than zero.');
      }
    }

    if (updates.roundingIncrement !== undefined) {
      const val = Number(updates.roundingIncrement);
      if (isNaN(val) || val < 1) {
        throw new Error('Rounding increment must be at least 1.');
      }
    }

    if (updates.autoFareEnabled !== undefined) {
      const enabledStr = Boolean(updates.autoFareEnabled).toString();
      await query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('auto_fare_enabled', $1, 'Enable or disable automatic distance-based fare calculation', CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [enabledStr]
      );
    }

    if (updates.baseFare !== undefined) {
      await query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('auto_fare_base', $1, 'Base fare in INR for automatic distance calculation', CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [Number(updates.baseFare).toString()]
      );
    }

    if (updates.perKmRate !== undefined) {
      await query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('auto_fare_per_km', $1, 'Per-kilometre rate in INR for automatic distance calculation', CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [Number(updates.perKmRate).toString()]
      );
    }

    if (updates.maxDistanceKm !== undefined) {
      await query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('auto_fare_max_distance_km', $1, 'Maximum allowed road distance in km for automatic fare calculation', CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [Number(updates.maxDistanceKm).toString()]
      );
    }

    if (updates.roundingIncrement !== undefined) {
      await query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('auto_fare_rounding_increment', $1, 'Rounding increment in INR for automatic fare calculation', CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [Number(updates.roundingIncrement).toString()]
      );
    }

    return await this.getAutoFareSettings();
  }
}
