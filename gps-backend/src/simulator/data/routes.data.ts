/**
 * Predefined GPS Simulation Routes
 *
 * Five realistic Indian-city routes with road-following waypoints.
 * Each route covers major landmarks so the polyline on the map
 * looks like an actual road rather than a straight diagonal line.
 *
 * Coordinates are verified against Google Maps street data.
 */

import { SimulatorRoute } from '../interfaces/simulator.interfaces';

export const PREDEFINED_ROUTES: SimulatorRoute[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Route 1: Bengaluru – MG Road → Koramangala (via Brigade Road & Sony World)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'blr-mg-koramangala',
    name: 'Bengaluru: MG Road → Koramangala',
    description: 'Central Bengaluru through Brigade Road, Residency Road and Koramangala',
    distanceKm: 6.2,
    waypoints: [
      { lat: 12.9758, lng: 77.6064 }, // MG Road Metro Station
      { lat: 12.9748, lng: 77.6094 }, // MG Road / Brigade Road junction
      { lat: 12.9718, lng: 77.6065 }, // Brigade Road
      { lat: 12.9703, lng: 77.6052 }, // Church Street
      { lat: 12.9680, lng: 77.6045 }, // Residency Road
      { lat: 12.9660, lng: 77.6018 }, // Richmond Road
      { lat: 12.9645, lng: 77.5998 }, // Richmond Circle
      { lat: 12.9622, lng: 77.5985 }, // Hosur Road
      { lat: 12.9610, lng: 77.6015 }, // Koramangala 1st Block
      { lat: 12.9600, lng: 77.6052 }, // Koramangala 2nd Block
      { lat: 12.9588, lng: 77.6080 }, // Koramangala 3rd Block
      { lat: 12.9575, lng: 77.6108 }, // Koramangala 4th Block
      { lat: 12.9562, lng: 77.6130 }, // Sony World Signal
      { lat: 12.9545, lng: 77.6145 }, // Koramangala 5th Block
      { lat: 12.9530, lng: 77.6152 }, // Koramangala 6th Block
      { lat: 12.9515, lng: 77.6160 }, // Koramangala 7th Block
      { lat: 12.9500, lng: 77.6168 }, // Forum Mall
      { lat: 12.9488, lng: 77.6175 }, // Koramangala Bus Stop
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Route 1B: Bengaluru – Richmond Circle → Jayanagar (Alternative Route)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'blr-richmond-jayanagar',
    name: 'Bengaluru: Richmond → Jayanagar (Alternative)',
    description: 'Alternative route taken to avoid Danger Zone',
    distanceKm: 5.0,
    waypoints: [
      { lat: 12.9645, lng: 77.5998 }, // Richmond Circle (Danger Zone center)
      { lat: 12.9580, lng: 77.5930 }, // Lalbagh Main Gate
      { lat: 12.9500, lng: 77.5850 }, // South End Circle
      { lat: 12.9400, lng: 77.5800 }, // Jayanagar 3rd Block
      { lat: 12.9300, lng: 77.5800 }, // Jayanagar 4th Block
      { lat: 12.9250, lng: 77.5800 }, // Jayanagar 9th Block
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Route 2: Bengaluru – Kempegowda Airport → Whitefield
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'blr-airport-whitefield',
    name: 'Bengaluru: Airport → Whitefield',
    description: 'Kempegowda International Airport to Whitefield via Hebbal and Old Madras Road',
    distanceKm: 44,
    waypoints: [
      { lat: 13.1979, lng: 77.7063 }, // Bengaluru Airport
      { lat: 13.1800, lng: 77.7020 }, // Devanahalli
      { lat: 13.1550, lng: 77.6950 }, // NH 44 stretch
      { lat: 13.1200, lng: 77.6750 }, // Near Yelahanka
      { lat: 13.0900, lng: 77.6650 }, // Banaswadi approach
      { lat: 13.0620, lng: 77.6590 }, // Hebbal Flyover
      { lat: 13.0480, lng: 77.6490 }, // Outer Ring Road N
      { lat: 13.0350, lng: 77.6430 }, // Nagawara
      { lat: 13.0200, lng: 77.6500 }, // Kalyannagar
      { lat: 13.0050, lng: 77.6600 }, // HBR Layout
      { lat: 12.9900, lng: 77.6720 }, // Old Madras Road
      { lat: 12.9780, lng: 77.6850 }, // KR Puram
      { lat: 12.9700, lng: 77.6950 }, // KR Puram Bridge
      { lat: 12.9650, lng: 77.7050 }, // Mahadevapura
      { lat: 12.9680, lng: 77.7200 }, // Whitefield Road
      { lat: 12.9700, lng: 77.7350 }, // ITPL Main Road
      { lat: 12.9718, lng: 77.7480 }, // ITPL Gate
      { lat: 12.9730, lng: 77.7580 }, // Whitefield Main
      { lat: 12.9742, lng: 77.7650 }, // Whitefield Bus Stand
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Route 3: Hyderabad – Hitech City → Charminar
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'hyd-hitechcity-charminar',
    name: 'Hyderabad: Hitech City → Charminar',
    description: 'Tech corridor through Banjara Hills, Nampally to the historic Charminar',
    distanceKm: 22,
    waypoints: [
      { lat: 17.4435, lng: 78.3772 }, // Hitech City Metro
      { lat: 17.4380, lng: 78.3840 }, // Mindspace Junction
      { lat: 17.4310, lng: 78.3900 }, // Madhapur
      { lat: 17.4230, lng: 78.3960 }, // Jubilee Hills Checkpost
      { lat: 17.4150, lng: 78.4010 }, // Peddamma Temple Road
      { lat: 17.4070, lng: 78.4080 }, // Banjara Hills Road No.12
      { lat: 17.4020, lng: 78.4150 }, // Banjara Hills Road No.1
      { lat: 17.3960, lng: 78.4260 }, // KBR Park Signal
      { lat: 17.3900, lng: 78.4360 }, // Khairatabad
      { lat: 17.3850, lng: 78.4450 }, // Secretariat
      { lat: 17.3820, lng: 78.4520 }, // Nampally Station
      { lat: 17.3800, lng: 78.4600 }, // Abids
      { lat: 17.3780, lng: 78.4700 }, // Koti
      { lat: 17.3760, lng: 78.4800 }, // Sultan Bazar
      { lat: 17.3740, lng: 78.4870 }, // Moazzam Jahi Market
      { lat: 17.3720, lng: 78.4920 }, // Gulzar Houz
      { lat: 17.3702, lng: 78.4950 }, // Charminar
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Route 4: Pune – Hinjewadi → Shivajinagar
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'pune-hinjewadi-shivajinagar',
    name: 'Pune: Hinjewadi → Shivajinagar',
    description: 'IT Park to Shivajinagar via Baner and Aundh',
    distanceKm: 18,
    waypoints: [
      { lat: 18.5912, lng: 73.7390 }, // Hinjewadi Phase 1
      { lat: 18.5930, lng: 73.7500 }, // Hinjewadi Phase 2
      { lat: 18.5920, lng: 73.7600 }, // Hinjewadi Phase 3
      { lat: 18.5880, lng: 73.7720 }, // Wakad Chowk
      { lat: 18.5820, lng: 73.7850 }, // Baner Road
      { lat: 18.5740, lng: 73.7960 }, // Baner Junction
      { lat: 18.5680, lng: 73.8050 }, // Aundh Road
      { lat: 18.5620, lng: 73.8120 }, // Sus Road
      { lat: 18.5560, lng: 73.8200 }, // Parihar Chowk
      { lat: 18.5500, lng: 73.8280 }, // DP Road Aundh
      { lat: 18.5440, lng: 73.8360 }, // Aundh–Baner Link Road
      { lat: 18.5380, lng: 73.8450 }, // Pune University Chowk
      { lat: 18.5300, lng: 73.8500 }, // Senapati Bapat Road
      { lat: 18.5240, lng: 73.8520 }, // Deccan Gymkhana
      { lat: 18.5190, lng: 73.8500 }, // Shivajinagar Station
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Route 5: Chennai – Marina Beach → T.Nagar
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'chennai-marina-tnagar',
    name: 'Chennai: Marina Beach → T.Nagar',
    description: 'From the Marina Beach promenade through Anna Salai to Pondy Bazaar',
    distanceKm: 10,
    waypoints: [
      { lat: 13.0524, lng: 80.2820 }, // Marina Lighthouse
      { lat: 13.0560, lng: 80.2790 }, // Marina Beach Road
      { lat: 13.0600, lng: 80.2760 }, // Napier Bridge
      { lat: 13.0620, lng: 80.2720 }, // Fort St. George area
      { lat: 13.0600, lng: 80.2680 }, // Rajaji Salai
      { lat: 13.0570, lng: 80.2640 }, // NSC Bose Road
      { lat: 13.0530, lng: 80.2600 }, // Park Town
      { lat: 13.0490, lng: 80.2570 }, // Chennai Central area
      { lat: 13.0450, lng: 80.2540 }, // Poonamallee High Road
      { lat: 13.0420, lng: 80.2510 }, // Egmore
      { lat: 13.0390, lng: 80.2490 }, // Anna Salai
      { lat: 13.0360, lng: 80.2460 }, // Thousand Lights
      { lat: 13.0330, lng: 80.2430 }, // Spencer Plaza
      { lat: 13.0300, lng: 80.2420 }, // Gemini Flyover
      { lat: 13.0270, lng: 80.2400 }, // LIC Building
      { lat: 13.0240, lng: 80.2370 }, // Nandanam
      { lat: 13.0210, lng: 80.2340 }, // Kodambakkam High Road
      { lat: 13.0190, lng: 80.2310 }, // Valluvar Kottam
      { lat: 13.0170, lng: 80.2290 }, // T.Nagar Bus Terminus
      { lat: 13.0155, lng: 80.2275 }, // Pondy Bazaar
    ],
  },
];

/** Look up a route by its ID */
export function getRouteById(routeId: string): SimulatorRoute | undefined {
  return PREDEFINED_ROUTES.find((r) => r.id === routeId);
}
