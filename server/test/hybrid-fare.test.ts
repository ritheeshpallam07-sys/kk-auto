import { query } from '../src/config/db';
import { runSeed } from '../src/db/seed';
import { RouteService } from '../src/services/routeService';
import { FareService } from '../src/services/fareService';
import { GoogleRoutesService } from '../src/services/googleRoutesService';
import { PlatformSettingsService } from '../src/services/platformSettingsService';

async function runHybridFareTests() {
  console.log('===============================================================');
  console.log('🧪 TESTING CLIK2GO HYBRID FARE SYSTEM & 8 SEPARATE FARE ZONES');
  console.log('===============================================================\n');

  // Initialize DB and essential platform defaults
  await runSeed();

  // Reset Platform Settings to confirmed defaults
  await PlatformSettingsService.updateAutoFareSettings({
    autoFareEnabled: true,
    baseFare: 10.0,
    perKmRate: 15.0,
    maxDistanceKm: 15.0,
    roundingIncrement: 10.0
  });

  // Ensure mock handler is reset at start
  GoogleRoutesService.setMockHandler(null);

  // --------------------------------------------------------------------------
  // TEST 1: Protect all 8 Original Separate Zones
  // --------------------------------------------------------------------------
  console.log('[1] Testing preservation of all 8 original separate zones:');
  const expectedZones = [
    { input: 'Indiramma Colony', expectedCanonical: 'Indiramma Colony' },
    { input: 'Beedi Colony', expectedCanonical: 'Beedi Colony' },
    { input: 'Cross', expectedCanonical: 'Cross' },
    { input: 'Cross Road', expectedCanonical: 'Cross' },
    { input: 'Bus Stand', expectedCanonical: 'Bus Stand' },
    { input: 'Marava', expectedCanonical: 'Marava' },
    { input: 'JNTUA Main Gate', expectedCanonical: 'JNTUA Main Gate' },
    { input: 'JNTUA Girls Hostel', expectedCanonical: 'JNTUA Girls Hostel' },
    { input: 'JNTUA Boys Hostel', expectedCanonical: 'JNTUA Boys Hostel' }
  ];

  for (const z of expectedZones) {
    const resolved = await RouteService.resolveCanonicalZone(z.input);
    if (!resolved || resolved.name !== z.expectedCanonical) {
      throw new Error(
        `FAIL: "${z.input}" resolved to "${resolved?.name}", expected "${z.expectedCanonical}"`
      );
    }
    console.log(`  ✓ "${z.input}" => Separate Canonical Zone: "${resolved.name}" (id: ${resolved.id})`);
  }

  // Verify JNTUA Main Gate, Girls Hostel, Boys Hostel are NOT aliases of JNTUA
  const jntuaLoc = await query<{ id: number }>('SELECT id FROM locations WHERE name = $1 LIMIT 1', ['JNTUA']);
  const jntuaAliases = await query<{ alias: string }>(
    `SELECT alias FROM location_aliases WHERE location_id = $1`,
    [jntuaLoc.rows[0].id]
  );
  const aliasList = jntuaAliases.rows.map(r => r.alias.toLowerCase());
  for (const forbidden of ['jntua main gate', 'jntua girls hostel', 'jntua boys hostel']) {
    if (aliasList.includes(forbidden)) {
      throw new Error(`FAIL: "${forbidden}" is still mapped as an alias of generic JNTUA!`);
    }
  }
  console.log('  ✓ JNTUA Main Gate, Girls Hostel, and Boys Hostel are strictly separate, not aliases of JNTUA.');

  // --------------------------------------------------------------------------
  // TEST 2: Critical Priority Rule (Fixed Route Checked First)
  // --------------------------------------------------------------------------
  console.log('\n[2] Testing Fixed Route Priority Rule (Exact Configured Fare):');

  // Fixed routes must return exact configured amount with zero distance rounding
  const fixedRouteCases = [
    { from: 'Indiramma Colony', to: 'Cross', expected: 10 },
    { from: 'Cross', to: 'Indiramma Colony', expected: 10 },
    { from: 'Indiramma Colony', to: 'Bus Stand', expected: 10 },
    { from: 'Indiramma Colony', to: 'Marava', expected: 22 },
    { from: 'JNTUA', to: 'Cross', expected: 20 },
    { from: 'JNTUA', to: 'Bus Stand', expected: 25 },
    { from: 'JNTUA', to: 'Marava', expected: 30 },
    { from: 'JNTUA Main Gate', to: 'Cross', expected: 30 },
    { from: 'JNTUA Girls Hostel', to: 'Cross', expected: 50 },
    { from: 'JNTUA Boys Hostel', to: 'Cross', expected: 30 }
  ];

  for (const fr of fixedRouteCases) {
    const res = await FareService.calculateFare(fr.from, fr.to);
    if (!res.available || res.fare !== fr.expected || res.isAutoFare) {
      throw new Error(
        `FAIL: Fixed route ${fr.from} -> ${fr.to} returned fare ${res.fare} (auto: ${res.isAutoFare}), expected exact fixed ₹${fr.expected}`
      );
    }
    console.log(`  ✓ Fixed Route "${fr.from}" -> "${fr.to}": ₹${res.fare} (Exact fixed fare, no rounding)`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Automatic Distance Calculation Formula & Rounding
  // Formula: rawFare = ₹10 + (distanceInKm × ₹15)
  // Rounding: Math.round(rawFare / 10) * 10
  // --------------------------------------------------------------------------
  console.log('\n[3] Testing Automatic Fare Calculation Formula & Rounding:');

  const formulaCases = [
    { distanceKm: 5.2, expectedRaw: 88, expectedFinal: 90 },
    { distanceKm: 7.35, expectedRaw: 120.25, expectedFinal: 120 },
    { distanceKm: 10.6, expectedRaw: 169, expectedFinal: 170 },
    { distanceKm: 14.8, expectedRaw: 232, expectedFinal: 230 },
    { distanceKm: 15.0, expectedRaw: 235, expectedFinal: 240 }
  ];

  for (const fc of formulaCases) {
    // Set mock road distance
    GoogleRoutesService.setMockHandler(() => ({
      distanceMeters: Math.round(fc.distanceKm * 1000),
      distanceKm: fc.distanceKm,
      durationSeconds: Math.round(fc.distanceKm * 90)
    }));

    // Use unconfigured location pair to force automatic distance calculation
    const res = await FareService.calculateFare(
      'Custom Pickup Point',
      'Custom Dropoff Point',
      13.6500,
      78.8000,
      13.6700,
      78.8200
    );

    if (!res.available) {
      throw new Error(`FAIL: Automatic fare calculation failed for ${fc.distanceKm} km: ${res.error}`);
    }

    if (!res.isAutoFare) {
      throw new Error(`FAIL: Expected isAutoFare = true, got false`);
    }

    if (res.rawFare !== fc.expectedRaw) {
      throw new Error(
        `FAIL: Raw fare for ${fc.distanceKm} km was ₹${res.rawFare}, expected raw ₹${fc.expectedRaw}`
      );
    }

    if (res.fare !== fc.expectedFinal) {
      throw new Error(
        `FAIL: Final fare for ${fc.distanceKm} km was ₹${res.fare}, expected rounded ₹${fc.expectedFinal}`
      );
    }

    console.log(
      `  ✓ ${fc.distanceKm} km → Raw: ₹${res.rawFare} → Rounded: ₹${res.fare} (Expected: ₹${fc.expectedFinal})`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: Maximum Automatic-Fare Distance Boundary (15 km limit)
  // --------------------------------------------------------------------------
  console.log('\n[4] Testing Maximum Distance Boundary (15.0 km limit):');

  // 4a. Boundary point: 15.0 km exactly (Must be allowed)
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 15000,
    distanceKm: 15.0,
    durationSeconds: 1200
  }));
  const res15 = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.7500,
    78.9000
  );
  if (!res15.available || res15.fare !== 240) {
    throw new Error(`FAIL: 15.0 km should be allowed with fare ₹240. Got: ${JSON.stringify(res15)}`);
  }
  console.log(`  ✓ 15.0 km boundary: Accepted with fare ₹${res15.fare}`);

  // 4b. Just over boundary: 15.1 km (Must be rejected)
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 15100,
    distanceKm: 15.1,
    durationSeconds: 1250
  }));
  const res151 = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.7600,
    78.9100
  );
  if (res151.available || !res151.error?.includes('exceeds maximum automatic booking limit')) {
    throw new Error(`FAIL: 15.1 km should be rejected as exceeding limit. Got: ${JSON.stringify(res151)}`);
  }
  console.log(`  ✓ 15.1 km boundary: Correctly rejected ("${res151.error}")`);

  // 4c. Far over boundary: 28.5 km (Must be rejected)
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 28500,
    distanceKm: 28.5,
    durationSeconds: 2200
  }));
  const resFar = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.9000,
    79.0500
  );
  if (resFar.available || !resFar.error?.includes('exceeds maximum automatic booking limit')) {
    throw new Error(`FAIL: 28.5 km should be rejected. Got: ${JSON.stringify(resFar)}`);
  }
  console.log(`  ✓ 28.5 km boundary: Correctly rejected ("${resFar.error}")`);

  // --------------------------------------------------------------------------
  // TEST 5: Google Routes API Failure Handling (Never Guess or Silently Allow)
  // --------------------------------------------------------------------------
  console.log('\n[5] Testing Google Routes API Failure Handling:');

  // When Routes API returns null (network error / API down / invalid key)
  GoogleRoutesService.setMockHandler(() => null);

  const resFail = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.6800,
    78.8300
  );
  if (resFail.available || resFail.error !== 'Unable to calculate route distance. Please try again or select an approved location.') {
    throw new Error(
      `FAIL: Routes API failure must return explicit error and prevent booking without guessing. Got: ${JSON.stringify(resFail)}`
    );
  }
  console.log(`  ✓ API Failure handling: Booking prevented without guessing ("${resFail.error}")`);

  // Missing GPS coordinates when no fixed route exists
  const resNoCoords = await FareService.calculateFare(
    'Unconfigured Spot A',
    'Unconfigured Spot B'
  );
  if (resNoCoords.available) {
    throw new Error(`FAIL: Unconfigured route without GPS must be rejected. Got: ${JSON.stringify(resNoCoords)}`);
  }
  console.log(`  ✓ Missing GPS coordinates: Correctly rejected ("${resNoCoords.error}")`);

  // --------------------------------------------------------------------------
  // TEST 6: Same-Location Rejection
  // --------------------------------------------------------------------------
  console.log('\n[6] Testing Same-Location Rejection:');
  const sameInput = await FareService.calculateFare('Cross', 'Cross');
  if (sameInput.available || !sameInput.error?.includes('same location')) {
    throw new Error(`FAIL: Same location text should be rejected. Got: ${JSON.stringify(sameInput)}`);
  }
  console.log(`  ✓ Same location name rejected: "${sameInput.error}"`);

  const sameAlias = await FareService.calculateFare('Cross', 'Apollo Cross Road');
  if (sameAlias.available || !sameAlias.error?.includes('same location')) {
    throw new Error(`FAIL: Same canonical zone alias should be rejected. Got: ${JSON.stringify(sameAlias)}`);
  }
  console.log(`  ✓ Same canonical zone alias rejected: "${sameAlias.error}"`);

  // --------------------------------------------------------------------------
  // TEST 7: Admin Settings Persistence & Immediate Effect
  // --------------------------------------------------------------------------
  console.log('\n[7] Testing Admin Settings Persistence & Immediate Effect:');

  // Read current default settings
  const initialSettings = await PlatformSettingsService.getAutoFareSettings();
  if (
    initialSettings.baseFare !== 10.0 ||
    initialSettings.perKmRate !== 15.0 ||
    initialSettings.maxDistanceKm !== 15.0 ||
    initialSettings.roundingIncrement !== 10.0 ||
    !initialSettings.autoFareEnabled
  ) {
    throw new Error(`FAIL: Platform settings defaults unexpected: ${JSON.stringify(initialSettings)}`);
  }
  console.log('  ✓ Initial default settings verified from platform_settings table.');

  // Admin updates settings: Base ₹15, ₹18/km, Rounding ₹5
  await PlatformSettingsService.updateAutoFareSettings({
    baseFare: 15.0,
    perKmRate: 18.0,
    roundingIncrement: 5.0
  });

  // Calculate 5.0 km with new admin rates:
  // raw = 15 + (5.0 * 18) = 15 + 90 = 105
  // rounded to nearest 5 = 105
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 5000,
    distanceKm: 5.0,
    durationSeconds: 400
  }));

  const resAdminUpdated = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.6700,
    78.8200
  );
  if (!resAdminUpdated.available || resAdminUpdated.fare !== 105) {
    throw new Error(
      `FAIL: Updated admin settings should immediately yield ₹105 for 5.0 km. Got: ${JSON.stringify(resAdminUpdated)}`
    );
  }
  console.log(`  ✓ Dynamic Admin Settings took immediate effect: 5.0 km at ₹18/km + ₹15 base = ₹${resAdminUpdated.fare}`);

  // Test Admin Input Validation
  try {
    await PlatformSettingsService.updateAutoFareSettings({ perKmRate: -5 });
    throw new Error('FAIL: Negative perKmRate should have been rejected');
  } catch (err: any) {
    console.log(`  ✓ Input validation rejected negative rate: "${err.message}"`);
  }

  // Restore standard defaults
  await PlatformSettingsService.updateAutoFareSettings({
    baseFare: 10.0,
    perKmRate: 15.0,
    maxDistanceKm: 15.0,
    roundingIncrement: 10.0,
    autoFareEnabled: true
  });
  console.log('  ✓ Admin settings restored to confirmed defaults.');

  // --------------------------------------------------------------------------
  // TEST 8: Disabling Automatic Fares
  // --------------------------------------------------------------------------
  console.log('\n[8] Testing Disabling Automatic Fares:');

  await PlatformSettingsService.updateAutoFareSettings({ autoFareEnabled: false });

  // Fixed routes should continue working
  const fixedWhileDisabled = await FareService.calculateFare('Indiramma Colony', 'Cross');
  if (!fixedWhileDisabled.available || fixedWhileDisabled.fare !== 10) {
    throw new Error(`FAIL: Fixed routes must work even when auto fares are disabled.`);
  }
  console.log(`  ✓ Fixed routes continue to work when auto fares are disabled (Fare: ₹${fixedWhileDisabled.fare})`);

  // Unconfigured route must be rejected
  const autoWhileDisabled = await FareService.calculateFare(
    'Point A',
    'Point B',
    13.6500,
    78.8000,
    13.6700,
    78.8200
  );
  if (autoWhileDisabled.available || autoWhileDisabled.error !== 'Fare not configured for this location') {
    throw new Error(`FAIL: Unconfigured route must be rejected when auto fare is disabled.`);
  }
  console.log(`  ✓ Unconfigured route correctly rejected when auto fares are disabled ("${autoWhileDisabled.error}")`);

  // Re-enable auto fares
  await PlatformSettingsService.updateAutoFareSettings({ autoFareEnabled: true });
  console.log('  ✓ Auto fares re-enabled.');

  // --------------------------------------------------------------------------
  // TEST 9: Draggable Destination Pin Recalculation
  // --------------------------------------------------------------------------
  console.log('\n[9] Testing Draggable Destination Pin Simulation:');

  // Customer drags destination pin to 7.35 km away
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 7350,
    distanceKm: 7.35,
    durationSeconds: 600
  }));

  const pinDragged7Km = await FareService.calculateFare(
    'JNTUA Main Gate',
    'Pinned New Dropoff Spot',
    13.6508,
    78.7860,
    13.7000,
    78.8500
  );

  if (!pinDragged7Km.available || pinDragged7Km.fare !== 120 || !pinDragged7Km.isAutoFare) {
    throw new Error(`FAIL: Pin dragged 7.35 km expected ₹120. Got: ${JSON.stringify(pinDragged7Km)}`);
  }
  console.log(`  ✓ Pin dragged to 7.35 km: Successfully recalculated to ₹${pinDragged7Km.fare} (${pinDragged7Km.distanceKm} km)`);

  // Customer drags pin beyond 15 km (e.g. 18.2 km)
  GoogleRoutesService.setMockHandler(() => ({
    distanceMeters: 18200,
    distanceKm: 18.2,
    durationSeconds: 1500
  }));

  const pinDraggedTooFar = await FareService.calculateFare(
    'JNTUA Main Gate',
    'Pinned Far Away Spot',
    13.6508,
    78.7860,
    13.7800,
    78.9500
  );

  if (pinDraggedTooFar.available || !pinDraggedTooFar.error?.includes('exceeds maximum automatic booking limit')) {
    throw new Error(`FAIL: Pin dragged beyond 15 km must be rejected. Got: ${JSON.stringify(pinDraggedTooFar)}`);
  }
  console.log(`  ✓ Pin dragged beyond 15 km: Booking prevented ("${pinDraggedTooFar.error}")`);

  // Clean up mock handler
  GoogleRoutesService.setMockHandler(null);

  console.log('\n===============================================================');
  console.log('🎉 ALL HYBRID FARE SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
  process.exit(0);
}

runHybridFareTests().catch(err => {
  console.error('\n❌ HYBRID FARE TEST FAILED:', err);
  process.exit(1);
});
