import { RouteService, RouteFareResult, FareRouteRecord } from './routeService';

export class FareService {
  /**
   * Get fixed route fare estimate from database.
   * Strictly verifies route in fare_routes table.
   */
  public static async calculateFare(fromLocation: string, toLocation: string): Promise<RouteFareResult> {
    return RouteService.getRouteFare(fromLocation, toLocation);
  }

  public static async getAllFareRoutes(): Promise<FareRouteRecord[]> {
    return RouteService.getAllFareRoutes();
  }

  public static async updateRouteFare(id: number, fare: number): Promise<FareRouteRecord> {
    return RouteService.updateRouteFare(id, fare);
  }
}
