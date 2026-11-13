import { query } from '../src/db';
import { RouteService } from '../src/services/routeService';
import { FareService } from '../src/services/fareService';
import { runSeed } from '../src/db/seed';

async function runTests() {
  console.log('--- Testing Fare Zone & Location Alias Matching + Draggable Pin Logic ---');

  // Ensure DB schema and seed are up to date in isolated test DB
  await runSeed();

  // Test 1: Canonical Zone Resolution by Alias
  console.log('\n[1] Testing canonical zone resolution by alias:');
  const testAliases = [
    { input: 'Cross', expected: 'Cross' },
    { input: 'Cross Road', expected: 'Cross' },
    { input: 'Cross Road Apollo', expected: 'Cross' },
    { input: 'Apollo Cross Road', expected: 'Cross' },
    { input: 'Apollo Pharmacy Cross', expected: 'Cross' },
    { input: 'JNTUA', expected: 'JNTUA' },
    { input: 'JNTUA Main Gate', expected: 'JNTUA' },
    { input: 'Bus Stand', expected: 'Bus Stand' },
    { input: 'RTC Bus Stand', expected: 'Bus Stand' },
    { input: 'Marava', expected: 'Marava' },
    { input: 'Marava Circle', expected: 'Marava' }
  ];

  for (const t of testAliases) {
    const zone = await RouteService.resolveCanonicalZone(t.input);
    if (!zone || zone.name !== t.expected) {
      throw new Error(`FAIL: "${t.input}" resolved to "${zone?.name}", expected "${t.expected}"`);
    }
    console.log(`  ✓ "${t.input}" => Canonical Zone: "${zone.name}" (id: ${zone.id})`);
  }

  // Test 2: Route Fare with Aliases
  console.log('\n[2] Testing route fare calculation with canonical zones & aliases:');
  const testRoutes = [
    { from: 'JNTUA', to: 'Cross Road Apollo', expectedFare: 20 },
    { from: 'JNTUA', to: 'Apollo Cross Road', expectedFare: 20 },
    { from: 'Apollo Cross Road', to: 'JNTUA', expectedFare: 20 },
    { from: 'JNTUA', to: 'RTC Bus Stand', expectedFare: 25 },
    { from: 'JNTUA', to: 'Marava Circle', expectedFare: 30 }
  ];

  for (const tr of testRoutes) {
    const res = await RouteService.getRouteFare(tr.from, tr.to);
    if (!res.available || res.fare !== tr.expectedFare) {
      throw new Error(`FAIL: Fare between "${tr.from}" and "${tr.to}" was ${res.fare} (available: ${res.available}), expected ${tr.expectedFare}`);
    }
    console.log(`  ✓ Route "${tr.from}" -> "${tr.to}": Fare ₹${res.fare} (Canonical: ${res.fromLocation} -> ${res.toLocation})`);
  }

  // Test 3: Same Location / Same Zone Detection
  console.log('\n[3] Testing same-zone rejection:');
  const sameRes = await RouteService.getRouteFare('Cross', 'Apollo Cross Road');
  if (sameRes.available || !sameRes.error?.includes('same location')) {
    throw new Error(`FAIL: Same zone should be rejected. Got: ${JSON.stringify(sameRes)}`);
  }
  console.log(`  ✓ "Cross" -> "Apollo Cross Road" correctly rejected: "${sameRes.error}"`);

  // Test 4: Unapproved Locations Rejection
  console.log('\n[4] Testing unapproved locations rejection:');
  const unapproved = await RouteService.getRouteFare('JNTUA', 'Somewhere in Bengaluru');
  if (unapproved.available || unapproved.error !== 'Fare not configured for this location') {
    throw new Error(`FAIL: Expected "Fare not configured for this location", got: ${JSON.stringify(unapproved)}`);
  }
  console.log(`  ✓ Unapproved destination correctly rejected: "${unapproved.error}"`);

  // Test 5: Draggable Pin Simulation (GPS Coordinate Matching)
  console.log('\n[5] Testing draggable pin simulation (GPS coordinates):');
  // 5a. Pin dragged within Cross zone (150m from center: lat 13.6530, lng 78.8040)
  const draggedWithinZone = await RouteService.resolveCanonicalZone(
    'Pinned Location (13.6530, 78.8040)',
    13.6530,
    78.8040
  );
  if (!draggedWithinZone || draggedWithinZone.name !== 'Cross') {
    throw new Error(`FAIL: Coordinates (13.6530, 78.8040) should resolve to Cross. Got: ${draggedWithinZone?.name}`);
  }
  console.log(`  ✓ Dragged pin at (13.6530, 78.8040) correctly resolved to zone: "${draggedWithinZone.name}"`);

  const fareForDragged = await RouteService.getRouteFare(
    'JNTUA',
    'Custom Pinned Drop-off Spot',
    13.6508,
    78.7860,
    13.6530,
    78.8040
  );
  if (!fareForDragged.available || fareForDragged.fare !== 20) {
    throw new Error(`FAIL: Dragged pin fare expected 20. Got: ${JSON.stringify(fareForDragged)}`);
  }
  console.log(`  ✓ Fare for dragged pin drop-off spot: ₹${fareForDragged.fare} (${fareForDragged.fromLocation} -> ${fareForDragged.toLocation})`);

  // 5b. Pin dragged far outside approved zones (10km away: lat 13.7800, lng 78.9500)
  const draggedOutside = await RouteService.resolveCanonicalZone(
    'Pinned Location (13.7800, 78.9500)',
    13.7800,
    78.9500
  );
  if (draggedOutside !== null) {
    throw new Error(`FAIL: Coordinates (13.7800, 78.9500) should resolve to null. Got: ${draggedOutside?.name}`);
  }
  console.log(`  ✓ Dragged pin outside service area correctly resolved to: null`);

  const fareForOutside = await RouteService.getRouteFare(
    'JNTUA',
    'Far Outside Drop-off Spot',
    13.6508,
    78.7860,
    13.7800,
    78.9500
  );
  if (fareForOutside.available || fareForOutside.error !== 'Fare not configured for this location') {
    throw new Error(`FAIL: Expected 'Fare not configured for this location', got: ${JSON.stringify(fareForOutside)}`);
  }
  console.log(`  ✓ Fare calculation for outside pin correctly returned: "${fareForOutside.error}"`);

  // 5c. Pin dragged far outside even if address contains an alias word
  const draggedFarWithOldText = await RouteService.resolveCanonicalZone(
    'Cross Road Apollo',
    13.7800,
    78.9500
  );
  if (draggedFarWithOldText !== null) {
    throw new Error(`FAIL: Far coordinates with old alias text must NOT resolve to a zone. Got: ${draggedFarWithOldText?.name}`);
  }
  console.log(`  ✓ Pin dragged far away with stale alias text safely resolved to: null (prevented false fare assignment)`);

  // Test 6: Approved Zones API
  console.log('\n[6] Testing getApprovedZones API:');
  const approvedZones = await RouteService.getApprovedZones();
  if (!approvedZones || approvedZones.length === 0) {
    throw new Error('FAIL: getApprovedZones returned empty list');
  }
  const crossZone = approvedZones.find(z => z.name === 'Cross');
  if (!crossZone || !crossZone.aliases.includes('Cross Road Apollo') || !crossZone.aliases.includes('Apollo Cross Road')) {
    throw new Error(`FAIL: Cross zone missing expected aliases. Got: ${JSON.stringify(crossZone?.aliases)}`);
  }
  console.log(`  ✓ Approved zones list contains ${approvedZones.length} canonical zones, Cross has ${crossZone.aliases.length} aliases.`);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
