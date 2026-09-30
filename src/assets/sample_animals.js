// Built-in test wildlife samples for instant 1-click SIH judging and field demonstration

export const SAMPLE_WILDLIFE_CASES = [
  {
    id: "sample-tiger",
    title: "Bengal Tiger (Nocturnal Crossing)",
    species: "Tiger",
    imageUrl: "/sample_images/tiger.jpg",
    expectedConfidence: 88.9,
    zoneId: "Z-06",
    zoneName: "Tadoba Buffer South Sector",
    lat: 20.2380,
    lng: 79.3820,
    expectedRisk: "CRITICAL",
    distanceToSettlement: "180m from state highway corridor",
    description: "Camera-trap capture of an adult male Bengal Tiger traversing the southern buffer fringe."
  },
  {
    id: "sample-elephant",
    title: "Asian Elephant (Corridor Ingress)",
    species: "Asian Elephant",
    imageUrl: "/sample_images/elephant.jpg",
    expectedConfidence: 76.0,
    zoneId: "Z-04",
    zoneName: "Settlement Corridor Ramnagar",
    lat: 20.2667,
    lng: 79.4000,
    expectedRisk: "HIGH",
    distanceToSettlement: "290m from residential buffer boundary",
    description: "Trail camera sensor recording a sub-adult wild Asian elephant approaching crop fringe."
  },
  {
    id: "sample-leopard",
    title: "Indian Leopard (Village Perimeter)",
    species: "Leopard",
    imageUrl: "/sample_images/leopard.jpg",
    expectedConfidence: 91.2,
    zoneId: "Z-03",
    zoneName: "Moharli Forest Boundary Belt",
    lat: 20.2510,
    lng: 79.3860,
    expectedRisk: "HIGH",
    distanceToSettlement: "320m from village grazing land",
    description: "Thermal/optical camera capture of an Indian Leopard near rocky outcrop bordering human settlement."
  }
];
