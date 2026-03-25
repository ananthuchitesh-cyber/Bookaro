import type { TripFormData } from "@/lib/gemini";

type POI = { name: string; description: string; area: string; fee: number };
type Dish = { name: string; description: string; price: string; where: string; emoji: string };
type Spot = { name: string; specialty: string; price: string; location: string };

type DestinationProfile = {
  key: string;
  overview: string;
  bestSeason: string;
  pois: POI[];
  dishes: Dish[];
  restaurants: Spot[];
  streetFood: Spot[];
  nearby: Array<{ name: string; distance: string; why: string }>;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function normalizeCity(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FALLBACK_RAIL_HUBS: Record<string, string> = {
  munnar: "Aluva / Ernakulam Junction",
  ooty: "Mettupalayam / Coimbatore Junction",
  thenilgiris: "Mettupalayam / Coimbatore Junction",
  kodaikanal: "Kodai Road",
  coorg: "Mysuru Junction",
  kodagu: "Mysuru Junction",
  goa: "Madgaon / Thivim",
  mahabalipuram: "Chengalpattu / Chennai Egmore",
  yercaud: "Salem Junction",
  rishikesh: "Haridwar / Dehradun",
  kanyakumari: "Kanyakumari Junction",
};

const FALLBACK_AIR_HUBS: Record<string, string> = {
  munnar: "Kochi (COK)",
  ooty: "Coimbatore (CJB)",
  thenilgiris: "Coimbatore (CJB)",
  kodaikanal: "Madurai (IXM)",
  coorg: "Mangalore (IXE) or Bengaluru (BLR)",
  kodagu: "Mangalore (IXE) or Bengaluru (BLR)",
  goa: "Goa (GOI)",
  mahabalipuram: "Chennai (MAA)",
  yercaud: "Salem (SXV) or Coimbatore (CJB)",
  rishikesh: "Dehradun (DED)",
  kanyakumari: "Trivandrum (TRV)",
};

function fallbackRailHub(city: string): string {
  return FALLBACK_RAIL_HUBS[normalizeCity(city)] || `${city} nearest major railway station`;
}

function fallbackAirHub(city: string): string {
  return FALLBACK_AIR_HUBS[normalizeCity(city)] || `${city} nearest major airport`;
}

function fallbackTransportNotes(
  source: string,
  destination: string,
  mode: "flight" | "train" | "bus" | "car",
  totalPrice: number
): string {
  const path =
    mode === "train"
      ? `Go to ${fallbackRailHub(source)}, take a train toward ${fallbackRailHub(destination)}, then use cab/auto/local transport from the station to your stay in ${destination}.`
      : mode === "bus"
        ? `Board a direct or nearest available bus from ${source} main bus stand to ${destination}. After arrival, use cab/auto/local transport to your hotel and sightseeing spots.`
        : mode === "flight"
          ? `Fly from ${fallbackAirHub(source)} to ${fallbackAirHub(destination)}. After landing, use cab/airport taxi/local transport to reach your hotel in ${destination}.`
          : `Travel by road from ${source} to ${destination}. After arrival, use local cab/auto for hotel transfer and nearby sightseeing.`;
  return `Route: ${source} -> ${destination}
Suggested path: ${path}
Estimated fare: INR ${totalPrice.toLocaleString()} total.`;
}

const DESTINATION_ALIASES: Record<string, string> = {
  mysuru: "mysore",
  trichy: "trichy",
  tiruchirappalli: "trichy",
  tiruchi: "trichy",
  chola: "thanjavur",
  tanjore: "thanjavur",
  kodaikanalhills: "kodaikanal",
  kodai: "kodaikanal",
  mahabs: "mahabalipuram",
  mamallapuram: "mahabalipuram",
  nellai: "tirunelveli",
  tn: "tamilnadu",
  tamilnadu: "tamilnadu",
  tamilnad: "tamilnadu",
};

const PROFILES: DestinationProfile[] = [
  {
    key: "manali",
    overview: "Manali is known for mountain views, riverside cafes, and high-altitude excursions.",
    bestSeason: "March to June and October to February.",
    pois: [
      { name: "Hadimba Devi Temple", description: "Historic cedar-forest temple.", area: "Old Manali", fee: 0 },
      { name: "Solang Valley", description: "Paragliding and adventure hub.", area: "Solang", fee: 200 },
      { name: "Vashisht Hot Springs", description: "Natural hot water baths.", area: "Vashisht", fee: 100 },
      { name: "Mall Road", description: "Main shopping and cafe zone.", area: "Manali Town", fee: 0 },
      { name: "Jogini Waterfall Trail", description: "Scenic short trek.", area: "Vashisht", fee: 0 },
      { name: "Naggar Castle", description: "Heritage architecture and valley views.", area: "Naggar", fee: 75 },
      { name: "Old Manali Cafes", description: "Riverside food and live vibe.", area: "Old Manali", fee: 0 },
      { name: "Manu Temple", description: "Cultural and spiritual site.", area: "Old Manali", fee: 0 },
    ],
    dishes: [
      { name: "Siddu", description: "Steamed Himachali bread with fillings.", price: "Rs.80-180", where: "Old Manali eateries", emoji: "" },
      { name: "Trout Fish", description: "Local river trout preparation.", price: "Rs.350-700", where: "Riverside restaurants", emoji: "" },
      { name: "Babru", description: "Stuffed local fried bread snack.", price: "Rs.40-120", where: "Local stalls", emoji: "" },
    ],
    restaurants: [
      { name: "Johnsons Cafe", specialty: "Trout and continental", price: "Rs.500-1200", location: "Circuit House Road" },
      { name: "Cafe 1947", specialty: "Riverside cafe food", price: "Rs.400-1000", location: "Old Manali" },
      { name: "The Corner House", specialty: "Woodfired options", price: "Rs.350-900", location: "Model Town" },
    ],
    streetFood: [
      { name: "Mall Road Stalls", specialty: "Momos and rolls", price: "Rs.60-200", location: "Mall Road" },
      { name: "Old Manali Lane", specialty: "Quick bites", price: "Rs.80-220", location: "Old Manali" },
    ],
    nearby: [
      { name: "Kasol", distance: "75 km", why: "Parvati valley views and cafes." },
      { name: "Atal Tunnel Sissu", distance: "40 km", why: "High mountain drive and scenic stop." },
    ],
  },
  {
    key: "kerala",
    overview: "Kerala is famous for backwaters, beaches, spice cuisine, and hill stations.",
    bestSeason: "September to March.",
    pois: [
      { name: "Alleppey Backwaters", description: "Houseboat cruise and canals.", area: "Alappuzha", fee: 300 },
      { name: "Fort Kochi", description: "Colonial heritage and waterfront walk.", area: "Kochi", fee: 0 },
      { name: "Mattancherry Palace", description: "Museum and murals.", area: "Kochi", fee: 20 },
      { name: "Munnar Tea Museum", description: "Tea history and factory tour.", area: "Munnar", fee: 125 },
      { name: "Eravikulam National Park", description: "Nilgiri tahr reserve.", area: "Munnar", fee: 200 },
      { name: "Varkala Cliff", description: "Sea-facing cliffside promenade.", area: "Varkala", fee: 0 },
      { name: "Kovalam Beach", description: "Popular beach and sunset point.", area: "Kovalam", fee: 0 },
      { name: "Athirappilly Falls", description: "Iconic Kerala waterfall.", area: "Thrissur district", fee: 50 },
    ],
    dishes: [
      { name: "Appam with Stew", description: "Soft rice-hopper with coconut stew.", price: "Rs.120-300", where: "Traditional restaurants", emoji: "" },
      { name: "Kerala Sadya", description: "Banana leaf festive meal.", price: "Rs.180-450", where: "Local bhojanalayas", emoji: "" },
      { name: "Malabar Parotta & Curry", description: "Layered bread with spicy curry.", price: "Rs.100-300", where: "Malabar eateries", emoji: "" },
    ],
    restaurants: [
      { name: "Kashi Art Cafe", specialty: "Cafe breakfast and brunch", price: "Rs.350-900", location: "Fort Kochi" },
      { name: "Paragon", specialty: "Malabar cuisine", price: "Rs.400-1100", location: "Kozhikode/Kochi branches" },
      { name: "Grand Pavilion", specialty: "Kerala meals", price: "Rs.300-800", location: "MG Road, Kochi" },
    ],
    streetFood: [
      { name: "Fort Kochi Street Eats", specialty: "Seafood and snacks", price: "Rs.100-300", location: "Fort Kochi" },
      { name: "Kozhikode Food Street", specialty: "Malabar snacks", price: "Rs.80-250", location: "SM Street" },
    ],
    nearby: [
      { name: "Thekkady", distance: "140 km", why: "Wildlife and spice plantations." },
      { name: "Wayanad", distance: "270 km", why: "Waterfalls, caves, and viewpoints." },
    ],
  },
  {
    key: "mysore",
    overview: "Mysore is known for palaces, heritage markets, silk, and sandalwood culture.",
    bestSeason: "October to March.",
    pois: [
      { name: "Mysore Palace", description: "Royal architecture and evening illumination.", area: "City Center", fee: 100 },
      { name: "Chamundi Hills", description: "Temple and panoramic city view.", area: "Chamundi", fee: 0 },
      { name: "St. Philomenas Church", description: "Neo-gothic landmark.", area: "Lashkar Mohalla", fee: 0 },
      { name: "Devaraja Market", description: "Flower, spice, and local goods market.", area: "Devaraja", fee: 0 },
      { name: "Jaganmohan Palace", description: "Art gallery and heritage museum.", area: "Mysore", fee: 60 },
      { name: "Brindavan Gardens", description: "Musical fountain and evening walk.", area: "Krishnarajasagara", fee: 70 },
      { name: "Mysore Zoo", description: "One of Indias oldest zoos.", area: "Indira Nagar", fee: 120 },
      { name: "Karanji Lake", description: "Birding and nature walk.", area: "Nazarbad", fee: 50 },
    ],
    dishes: [
      { name: "Mysore Masala Dosa", description: "Spiced red chutney dosa.", price: "Rs.70-180", where: "Classic tiffin spots", emoji: "" },
      { name: "Mysore Pak", description: "Famous ghee sweet.", price: "Rs.150-400", where: "Sweet shops", emoji: "" },
      { name: "Bisi Bele Bath", description: "Rice-lentil Karnataka specialty.", price: "Rs.100-220", where: "Local messes", emoji: "" },
    ],
    restaurants: [
      { name: "Mylari", specialty: "Iconic dosa", price: "Rs.100-300", location: "Nazarbad" },
      { name: "Vinayaka Mylari", specialty: "South Indian breakfast", price: "Rs.120-300", location: "Mysore city" },
      { name: "RRR", specialty: "Andhra meals", price: "Rs.250-700", location: "Near Palace Road" },
    ],
    streetFood: [
      { name: "Devaraja Market Lane", specialty: "Snacks and sweets", price: "Rs.60-200", location: "Devaraja Market" },
      { name: "Sayyaji Rao Road Stalls", specialty: "Evening local bites", price: "Rs.80-220", location: "Mysore Central" },
    ],
    nearby: [
      { name: "Srirangapatna", distance: "18 km", why: "Historic fort and temples." },
      { name: "Somnathpur", distance: "35 km", why: "Hoysala temple architecture." },
    ],
  },
  {
    key: "goa",
    overview: "Goa blends beaches, nightlife, Portuguese heritage, and seafood culture.",
    bestSeason: "November to February.",
    pois: [
      { name: "Baga Beach", description: "Popular beach and water sports.", area: "North Goa", fee: 0 },
      { name: "Fort Aguada", description: "Sea fort with sunset views.", area: "Candolim", fee: 50 },
      { name: "Basilica of Bom Jesus", description: "UNESCO-listed historic church.", area: "Old Goa", fee: 0 },
      { name: "Anjuna Flea Market", description: "Souvenirs and boho shopping.", area: "Anjuna", fee: 0 },
      { name: "Dudhsagar Falls", description: "Waterfall excursion.", area: "Mollem", fee: 400 },
      { name: "Palolem Beach", description: "Scenic south Goa shoreline.", area: "South Goa", fee: 0 },
      { name: "Fontainhas Latin Quarter", description: "Colorful heritage neighborhood.", area: "Panaji", fee: 0 },
      { name: "Chapora Fort", description: "Hilltop sea viewpoint.", area: "Vagator", fee: 0 },
    ],
    dishes: [
      { name: "Goan Fish Curry Rice", description: "Classic coastal curry meal.", price: "Rs.220-550", where: "Beach shacks", emoji: "" },
      { name: "Prawn Balchao", description: "Spicy pickled prawn dish.", price: "Rs.280-650", where: "Goan restaurants", emoji: "" },
      { name: "Bebinca", description: "Traditional layered dessert.", price: "Rs.90-250", where: "Local bakeries", emoji: "" },
    ],
    restaurants: [
      { name: "Mum's Kitchen", specialty: "Authentic Goan cuisine", price: "Rs.600-1400", location: "Panaji" },
      { name: "Fisherman's Wharf", specialty: "Seafood", price: "Rs.700-1600", location: "Cavelossim" },
      { name: "Thalassa", specialty: "Sunset dining", price: "Rs.700-1700", location: "Siolim" },
    ],
    streetFood: [
      { name: "Calangute Snack Stalls", specialty: "Cutlets and ros omelette", price: "Rs.80-250", location: "Calangute" },
      { name: "Mapusa Evening Market", specialty: "Local snacks", price: "Rs.60-220", location: "Mapusa" },
    ],
    nearby: [
      { name: "Gokarna", distance: "145 km", why: "Quieter beaches and cliffs." },
      { name: "Amboli", distance: "105 km", why: "Monsoon viewpoints and waterfalls." },
    ],
  },
  {
    key: "jaipur",
    overview: "Jaipur offers forts, palaces, bazaars, and vibrant Rajasthani culture.",
    bestSeason: "October to March.",
    pois: [
      { name: "Amber Fort", description: "Grand hill fort with courtyards.", area: "Amer", fee: 200 },
      { name: "City Palace", description: "Royal complex and museum.", area: "Pink City", fee: 300 },
      { name: "Hawa Mahal", description: "Iconic palace facade.", area: "Badi Choupad", fee: 50 },
      { name: "Jantar Mantar", description: "Historic astronomical observatory.", area: "City Center", fee: 50 },
      { name: "Nahargarh Fort", description: "Sunset viewpoint over city.", area: "Aravalli", fee: 50 },
      { name: "Albert Hall Museum", description: "Art and artifacts.", area: "Ram Niwas Garden", fee: 40 },
      { name: "Bapu Bazaar", description: "Textiles and handicrafts.", area: "Jaipur Market", fee: 0 },
      { name: "Jal Mahal Viewpoint", description: "Lakeside palace views.", area: "Man Sagar Lake", fee: 0 },
    ],
    dishes: [
      { name: "Dal Baati Churma", description: "Signature Rajasthani platter.", price: "Rs.180-450", where: "Traditional thali restaurants", emoji: "" },
      { name: "Laal Maas", description: "Spicy mutton curry.", price: "Rs.300-800", where: "Specialty restaurants", emoji: "" },
      { name: "Ghewar", description: "Popular Rajasthani sweet.", price: "Rs.120-350", where: "Sweet shops", emoji: "" },
    ],
    restaurants: [
      { name: "Chokhi Dhani", specialty: "Rajasthani dining experience", price: "Rs.900-1800", location: "Tonk Road" },
      { name: "LMB", specialty: "Traditional vegetarian cuisine", price: "Rs.300-900", location: "Johari Bazaar" },
      { name: "Handi", specialty: "North Indian", price: "Rs.350-900", location: "MI Road" },
    ],
    streetFood: [
      { name: "Masala Chowk", specialty: "Kachori and chaat", price: "Rs.80-250", location: "Ram Niwas Garden" },
      { name: "MI Road Stalls", specialty: "Kulfi and snacks", price: "Rs.70-220", location: "MI Road" },
    ],
    nearby: [
      { name: "Ajmer-Pushkar", distance: "145 km", why: "Lake town and pilgrimage sites." },
      { name: "Bhangarh", distance: "85 km", why: "Historic fort ruins." },
    ],
  },
  {
    key: "varanasi",
    overview: "Varanasi is among the worlds oldest living cities, known for ghats and spiritual rituals.",
    bestSeason: "October to March.",
    pois: [
      { name: "Dashashwamedh Ghat", description: "Evening Ganga Aarti experience.", area: "Ghat Zone", fee: 0 },
      { name: "Kashi Vishwanath Temple", description: "Major Jyotirlinga temple.", area: "Godowlia", fee: 0 },
      { name: "Assi Ghat", description: "Sunrise and cultural programs.", area: "Assi", fee: 0 },
      { name: "Sarnath", description: "Buddhist heritage site.", area: "Sarnath", fee: 40 },
      { name: "Ramnagar Fort", description: "Historic fort and museum.", area: "Ramnagar", fee: 50 },
      { name: "Boat Ride on Ganga", description: "Classic riverfront view.", area: "Varanasi Ghats", fee: 200 },
      { name: "Manikarnika Ghat Viewpoint", description: "Spiritual and historical significance.", area: "Old City", fee: 0 },
      { name: "Banaras Hindu University Campus", description: "Iconic educational campus and Bharat Kala Bhavan.", area: "BHU", fee: 0 },
    ],
    dishes: [
      { name: "Kachori-Sabzi", description: "Classic Banarasi breakfast.", price: "Rs.40-140", where: "Old city stalls", emoji: "" },
      { name: "Tamatar Chaat", description: "Tangy local street specialty.", price: "Rs.60-180", where: "Godowlia and Lanka", emoji: "" },
      { name: "Banarasi Paan", description: "Iconic post-meal paan.", price: "Rs.30-120", where: "Paan shops near ghats", emoji: "" },
    ],
    restaurants: [
      { name: "Kashi Chat Bhandar", specialty: "Local street food", price: "Rs.120-350", location: "Godowlia" },
      { name: "Brown Bread Bakery", specialty: "Cafe and bakery", price: "Rs.200-600", location: "Near Dashashwamedh" },
      { name: "Baati Chokha", specialty: "Regional meals", price: "Rs.180-500", location: "Sigra" },
    ],
    streetFood: [
      { name: "Godowlia Food Lane", specialty: "Chaat and sweets", price: "Rs.60-220", location: "Godowlia" },
      { name: "Lanka Chauraha Stalls", specialty: "Student food hubs", price: "Rs.70-250", location: "Lanka" },
    ],
    nearby: [
      { name: "Prayagraj", distance: "120 km", why: "Sangam and heritage sites." },
      { name: "Vindhyachal", distance: "70 km", why: "Temple town and hill shrines." },
    ],
  },
  {
    key: "ladakh",
    overview: "Ladakh is known for high-altitude passes, monasteries, and stark mountain landscapes.",
    bestSeason: "May to September.",
    pois: [
      { name: "Shanti Stupa", description: "Sunset panorama over Leh.", area: "Leh", fee: 0 },
      { name: "Leh Palace", description: "Historic hilltop palace.", area: "Leh", fee: 25 },
      { name: "Thiksey Monastery", description: "Major Buddhist monastery complex.", area: "Thiksey", fee: 30 },
      { name: "Pangong Lake", description: "High-altitude iconic lake.", area: "Pangong", fee: 0 },
      { name: "Nubra Valley", description: "Dunes and mountain valleys.", area: "Nubra", fee: 0 },
      { name: "Khardung La", description: "High mountain pass drive.", area: "North of Leh", fee: 0 },
      { name: "Magnetic Hill", description: "Unique optical illusion stretch.", area: "Leh-Kargil Road", fee: 0 },
      { name: "Hall of Fame Museum", description: "War memorial and exhibits.", area: "Leh", fee: 30 },
    ],
    dishes: [
      { name: "Thukpa", description: "Warm noodle soup for cold climate.", price: "Rs.120-280", where: "Leh cafes", emoji: "" },
      { name: "Momos", description: "Steamed dumplings.", price: "Rs.80-220", where: "Street stalls and cafes", emoji: "" },
      { name: "Butter Tea", description: "Traditional salted tea.", price: "Rs.50-140", where: "Local tea houses", emoji: "" },
    ],
    restaurants: [
      { name: "The Tibetan Kitchen", specialty: "Tibetan cuisine", price: "Rs.250-700", location: "Fort Road, Leh" },
      { name: "Gesmo Restaurant", specialty: "Ladakhi and global", price: "Rs.250-750", location: "Main Bazaar, Leh" },
      { name: "Bon Appetit", specialty: "Scenic dining", price: "Rs.400-1200", location: "Changspa, Leh" },
    ],
    streetFood: [
      { name: "Leh Main Market Stalls", specialty: "Quick Tibetan bites", price: "Rs.70-220", location: "Main Bazaar" },
      { name: "Changspa Cafe Strip", specialty: "Tea and snacks", price: "Rs.80-260", location: "Changspa" },
    ],
    nearby: [
      { name: "Tso Moriri", distance: "220 km", why: "Remote lake and wildlife." },
      { name: "Alchi", distance: "70 km", why: "Ancient monastery murals." },
    ],
  },
  {
    key: "ooty",
    overview: "Ooty is a classic Nilgiri hill station with lakes, gardens, and tea estates.",
    bestSeason: "October to June.",
    pois: [
      { name: "Ooty Lake", description: "Boating and lakeside leisure.", area: "Ooty", fee: 50 },
      { name: "Government Botanical Garden", description: "Historic garden and flower beds.", area: "Udhagamandalam", fee: 30 },
      { name: "Doddabetta Peak", description: "Highest point in Nilgiris.", area: "Doddabetta", fee: 20 },
      { name: "Tea Museum", description: "Tea-making insights and tasting.", area: "Ooty", fee: 30 },
      { name: "Rose Garden", description: "Terraced rose collection.", area: "Vijayanagaram", fee: 30 },
      { name: "Pykara Lake and Falls", description: "Scenic outing spot.", area: "Pykara", fee: 30 },
      { name: "Nilgiri Mountain Railway", description: "UNESCO toy train ride.", area: "Ooty Station", fee: 200 },
      { name: "Wenlock Downs", description: "Open grassland viewpoints.", area: "Shooting Point", fee: 0 },
    ],
    dishes: [
      { name: "Ooty Varkey", description: "Famous flaky local biscuit.", price: "Rs.40-140", where: "Local bakeries", emoji: "" },
      { name: "Vegetable Stew", description: "Warm hill-station comfort food.", price: "Rs.120-280", where: "Family restaurants", emoji: "" },
      { name: "Homemade Chocolates", description: "Ooty specialty sweets.", price: "Rs.100-400", where: "Chocolate shops", emoji: "" },
    ],
    restaurants: [
      { name: "Earl's Secret", specialty: "Continental and Indian", price: "Rs.500-1300", location: "Kings Cliff Road" },
      { name: "Shinkow's", specialty: "Chinese", price: "Rs.300-900", location: "Commercial Road" },
      { name: "Nahar's Sidewalk Cafe", specialty: "Vegetarian and desserts", price: "Rs.250-800", location: "Charing Cross" },
    ],
    streetFood: [
      { name: "Charing Cross Stalls", specialty: "Corn and snacks", price: "Rs.60-220", location: "Charing Cross" },
      { name: "Ooty Market Lane", specialty: "Tea and quick bites", price: "Rs.60-200", location: "Main Market" },
    ],
    nearby: [
      { name: "Coonoor", distance: "20 km", why: "Tea estates and viewpoints." },
      { name: "Kotagiri", distance: "32 km", why: "Quieter hill station trails." },
    ],
  },
  {
    key: "coorg",
    overview: "Coorg is known for coffee estates, waterfalls, and misty Western Ghats landscapes.",
    bestSeason: "October to March.",
    pois: [
      { name: "Raja's Seat", description: "Sunset viewpoint and gardens.", area: "Madikeri", fee: 20 },
      { name: "Abbey Falls", description: "Popular waterfall near coffee estates.", area: "Madikeri", fee: 15 },
      { name: "Namdroling Monastery", description: "Golden Temple complex.", area: "Bylakuppe", fee: 0 },
      { name: "Dubare Elephant Camp", description: "River and elephant activities.", area: "Kushalnagar", fee: 150 },
      { name: "Talacauvery", description: "Origin point of river Cauvery.", area: "Brahmagiri", fee: 0 },
      { name: "Mandalpatti Viewpoint", description: "Jeep route panoramic views.", area: "Mandalpatti", fee: 100 },
      { name: "Madikeri Fort", description: "Local history landmark.", area: "Madikeri", fee: 0 },
      { name: "Coffee Estate Walk", description: "Plantation trails and tasting.", area: "Coorg Estates", fee: 200 },
    ],
    dishes: [
      { name: "Pandi Curry", description: "Traditional Coorg pork curry.", price: "Rs.250-700", where: "Kodava restaurants", emoji: "" },
      { name: "Kadambuttu", description: "Rice dumplings paired with curries.", price: "Rs.120-280", where: "Local homes/restaurants", emoji: "" },
      { name: "Filter Coffee", description: "Fresh estate coffee brew.", price: "Rs.40-150", where: "Cafe and estate outlets", emoji: "" },
    ],
    restaurants: [
      { name: "Coorg Cuisine", specialty: "Kodava meals", price: "Rs.300-900", location: "Madikeri" },
      { name: "Raintree", specialty: "South Indian and seafood", price: "Rs.350-1000", location: "Madikeri" },
      { name: "East End", specialty: "Multi-cuisine", price: "Rs.300-900", location: "Madikeri town" },
    ],
    streetFood: [
      { name: "Madikeri Evening Stalls", specialty: "Snacks and coffee", price: "Rs.70-220", location: "Madikeri center" },
      { name: "Kushalnagar Quick Bites", specialty: "Local snacks", price: "Rs.60-200", location: "Kushalnagar" },
    ],
    nearby: [
      { name: "Nagarhole", distance: "95 km", why: "Wildlife safari." },
      { name: "Chikmagalur", distance: "150 km", why: "Coffee hills and viewpoints." },
    ],
  },
  {
    key: "rishikesh",
    overview: "Rishikesh is a spiritual and adventure destination on the Ganga.",
    bestSeason: "September to April.",
    pois: [
      { name: "Laxman Jhula Area", description: "Iconic river bridge and cafes.", area: "Tapovan", fee: 0 },
      { name: "Ram Jhula", description: "River crossing and ashram zone.", area: "Muni Ki Reti", fee: 0 },
      { name: "Triveni Ghat Aarti", description: "Evening spiritual ceremony.", area: "Triveni Ghat", fee: 0 },
      { name: "Neer Garh Waterfall", description: "Short trek waterfall point.", area: "Rishikesh outskirts", fee: 30 },
      { name: "White Water Rafting Stretch", description: "Popular adventure activity.", area: "Shivpuri-Rishikesh", fee: 1200 },
      { name: "Beatles Ashram", description: "Art-filled meditation site.", area: "Rajaji buffer", fee: 150 },
      { name: "Parmarth Niketan", description: "Major ashram and yoga center.", area: "Swarg Ashram", fee: 0 },
      { name: "Kunjapuri Temple Viewpoint", description: "Sunrise hilltop views.", area: "Kunjapuri", fee: 0 },
    ],
    dishes: [
      { name: "Aloo Puri", description: "Classic North Indian breakfast.", price: "Rs.60-180", where: "Local eateries", emoji: "" },
      { name: "Kachori-Jalebi", description: "Popular morning combo.", price: "Rs.70-220", where: "Street shops", emoji: "" },
      { name: "Sattvic Thali", description: "Light vegetarian meal.", price: "Rs.150-350", where: "Ashram cafes", emoji: "" },
    ],
    restaurants: [
      { name: "Chotiwala", specialty: "North Indian vegetarian", price: "Rs.200-700", location: "Ram Jhula" },
      { name: "The 60's Cafe", specialty: "Riverside cafe food", price: "Rs.300-900", location: "Laxman Jhula" },
      { name: "Little Buddha Cafe", specialty: "Continental and Indian", price: "Rs.250-850", location: "Laxman Jhula" },
    ],
    streetFood: [
      { name: "Triveni Ghat Stalls", specialty: "Snacks after aarti", price: "Rs.60-220", location: "Triveni Ghat" },
      { name: "Tapovan Lane", specialty: "Quick bites and shakes", price: "Rs.70-250", location: "Tapovan" },
    ],
    nearby: [
      { name: "Haridwar", distance: "24 km", why: "Ghats and evening aarti." },
      { name: "Devprayag", distance: "74 km", why: "Confluence and mountain drive." },
    ],
  },
  {
    key: "udaipur",
    overview: "Udaipur is known for lakes, palaces, and romantic old-city charm.",
    bestSeason: "October to March.",
    pois: [
      { name: "City Palace Udaipur", description: "Royal palace and museum complex.", area: "Old City", fee: 300 },
      { name: "Lake Pichola Boat Ride", description: "Sunset lake experience.", area: "Pichola", fee: 400 },
      { name: "Jag Mandir", description: "Island palace stop.", area: "Lake Pichola", fee: 0 },
      { name: "Sajjangarh (Monsoon Palace)", description: "Hilltop sunset viewpoint.", area: "Bansdara Hills", fee: 100 },
      { name: "Saheliyon ki Bari", description: "Historic garden and fountains.", area: "Fateh Sagar Road", fee: 40 },
      { name: "Bagore Ki Haveli", description: "Cultural show and heritage museum.", area: "Gangaur Ghat", fee: 60 },
      { name: "Fateh Sagar Lake", description: "Evening promenade.", area: "Fateh Sagar", fee: 0 },
      { name: "Jagdish Temple", description: "Historic temple architecture.", area: "Old City", fee: 0 },
    ],
    dishes: [
      { name: "Dal Baati Churma", description: "Rajasthani staple meal.", price: "Rs.180-450", where: "Traditional restaurants", emoji: "" },
      { name: "Gatte ki Sabzi", description: "Gram flour dumpling curry.", price: "Rs.160-350", where: "Rajasthani eateries", emoji: "" },
      { name: "Mawa Kachori", description: "Sweet stuffed kachori.", price: "Rs.60-180", where: "Sweet shops", emoji: "" },
    ],
    restaurants: [
      { name: "Ambrai", specialty: "Lake-view dining", price: "Rs.900-2200", location: "Amet Haveli" },
      { name: "Natraj Dining Hall", specialty: "Rajasthani thali", price: "Rs.250-600", location: "Surajpole" },
      { name: "Upre", specialty: "Rooftop views", price: "Rs.600-1600", location: "Gangaur Ghat" },
    ],
    streetFood: [
      { name: "Old City Food Lane", specialty: "Kachori and sweets", price: "Rs.60-220", location: "Bapu Bazaar area" },
      { name: "Fateh Sagar Stalls", specialty: "Evening snacks", price: "Rs.70-250", location: "Fateh Sagar" },
    ],
    nearby: [
      { name: "Kumbhalgarh", distance: "85 km", why: "Great wall fort and history." },
      { name: "Ranakpur", distance: "95 km", why: "Marble Jain temple architecture." },
    ],
  },
  {
    key: "darjeeling",
    overview: "Darjeeling offers Himalayan views, tea estates, and colonial-era hill town vibes.",
    bestSeason: "March to May and October to December.",
    pois: [
      { name: "Tiger Hill", description: "Sunrise view over Kanchenjunga.", area: "Darjeeling", fee: 50 },
      { name: "Batasia Loop", description: "Toy train loop and memorial.", area: "Ghum", fee: 20 },
      { name: "Darjeeling Himalayan Railway Ride", description: "UNESCO toy train journey.", area: "Darjeeling", fee: 250 },
      { name: "Tea Garden Tour", description: "Estate walk and tasting.", area: "Happy Valley", fee: 150 },
      { name: "Peace Pagoda", description: "Calm hilltop monument.", area: "Jalapahar", fee: 0 },
      { name: "Padmaja Naidu Zoo", description: "High-altitude fauna conservation center.", area: "Jawahar Road", fee: 110 },
      { name: "Himalayan Mountaineering Institute", description: "Everest and mountaineering history.", area: "Darjeeling", fee: 100 },
      { name: "Chowrasta Mall Road", description: "Town center promenade.", area: "Chowrasta", fee: 0 },
    ],
    dishes: [
      { name: "Darjeeling Momos", description: "Steamed dumplings with chutney.", price: "Rs.80-220", where: "Town cafes", emoji: "" },
      { name: "Thenthuk", description: "Flat-noodle Tibetan soup.", price: "Rs.120-280", where: "Local eateries", emoji: "" },
      { name: "Darjeeling Tea", description: "World-famous black tea.", price: "Rs.80-250", where: "Tea lounges", emoji: "" },
    ],
    restaurants: [
      { name: "Kunga Restaurant", specialty: "Tibetan dishes", price: "Rs.200-700", location: "Gandhi Road" },
      { name: "Glenary's", specialty: "Bakery and cafe", price: "Rs.250-900", location: "Nehru Road" },
      { name: "Sonam's Kitchen", specialty: "Breakfast and coffee", price: "Rs.200-700", location: "Chowrasta area" },
    ],
    streetFood: [
      { name: "Chowk Bazaar Stalls", specialty: "Momos and noodles", price: "Rs.70-220", location: "Chowk Bazaar" },
      { name: "Mall Road Stands", specialty: "Tea and snacks", price: "Rs.60-180", location: "Mall Road" },
    ],
    nearby: [
      { name: "Kalimpong", distance: "50 km", why: "Monasteries and viewpoints." },
      { name: "Mirik", distance: "49 km", why: "Lake town day trip." },
    ],
  },
  {
    key: "munnar",
    overview: "Munnar is known for tea gardens, cool climate, and rolling hill landscapes.",
    bestSeason: "September to March.",
    pois: [
      { name: "Eravikulam National Park", description: "Home of Nilgiri tahr.", area: "Munnar", fee: 200 },
      { name: "Tea Museum", description: "Tea legacy and processing insights.", area: "Munnar", fee: 125 },
      { name: "Mattupetty Dam", description: "Lake and scenic mountain views.", area: "Mattupetty", fee: 0 },
      { name: "Echo Point", description: "Popular viewpoint by the lake.", area: "Munnar", fee: 30 },
      { name: "Top Station", description: "Panoramic valley vista.", area: "Top Station", fee: 0 },
      { name: "Attukad Waterfalls", description: "Monsoon-friendly waterfall point.", area: "Munnar outskirts", fee: 0 },
      { name: "Kundala Lake", description: "Pedal boats and calm valley views.", area: "Kundala", fee: 0 },
      { name: "Blossom Park", description: "Leisure family park.", area: "Munnar Town", fee: 20 },
    ],
    dishes: [
      { name: "Kerala Appam", description: "Soft lace rice pancake.", price: "Rs.90-220", where: "Munnar restaurants", emoji: "" },
      { name: "Puttu and Kadala", description: "Steamed rice cake with chickpea curry.", price: "Rs.100-250", where: "Breakfast eateries", emoji: "" },
      { name: "Banana Fry", description: "Kerala tea-time snack.", price: "Rs.40-120", where: "Tea stalls", emoji: "" },
    ],
    restaurants: [
      { name: "Rapsy Restaurant", specialty: "Kerala and South Indian", price: "Rs.200-700", location: "Munnar town" },
      { name: "SN Restaurant", specialty: "Local meals", price: "Rs.180-650", location: "Munnar center" },
      { name: "Saravana Bhavan", specialty: "Vegetarian", price: "Rs.180-600", location: "Munnar" },
    ],
    streetFood: [
      { name: "Munnar Market Snacks", specialty: "Tea and fried bites", price: "Rs.50-180", location: "Munnar town" },
      { name: "Bus Stand Food Lane", specialty: "Quick local meals", price: "Rs.80-220", location: "Munnar bus area" },
    ],
    nearby: [
      { name: "Thekkady", distance: "95 km", why: "Periyar wildlife and spice tours." },
      { name: "Marayoor", distance: "40 km", why: "Sandalwood forests and dolmens." },
    ],
  },
  {
    key: "chennai",
    overview: "Chennai blends beaches, temples, museums, music, and strong South Indian food culture.",
    bestSeason: "November to February.",
    pois: [
      { name: "Marina Beach", description: "Iconic urban beach and promenade.", area: "Marina", fee: 0 },
      { name: "Kapaleeshwarar Temple", description: "Historic Dravidian temple complex.", area: "Mylapore", fee: 0 },
      { name: "San Thome Basilica", description: "Heritage church by the coast.", area: "Santhome", fee: 0 },
      { name: "Government Museum", description: "Archaeology and art collections.", area: "Egmore", fee: 50 },
      { name: "DakshinaChitra", description: "South Indian heritage center.", area: "ECR", fee: 120 },
      { name: "Besant Nagar Beach", description: "Evening walk and food stalls.", area: "Elliot's Beach", fee: 0 },
      { name: "Fort St. George", description: "Colonial-era fort museum.", area: "George Town", fee: 25 },
      { name: "Semmozhi Poonga", description: "Urban botanical garden.", area: "Teynampet", fee: 30 },
    ],
    dishes: [
      { name: "Filter Coffee", description: "Classic South Indian brew.", price: "Rs.30-120", where: "Traditional tiffin cafes", emoji: "" },
      { name: "Ghee Roast Dosa", description: "Crisp dosa with chutneys.", price: "Rs.90-220", where: "Tiffin restaurants", emoji: "" },
      { name: "Sambar Idli", description: "Soft idli in hot sambar.", price: "Rs.60-180", where: "Local messes", emoji: "" },
    ],
    restaurants: [
      { name: "Murugan Idli Shop", specialty: "Idli and podi meals", price: "Rs.150-450", location: "T Nagar / multiple branches" },
      { name: "Ratna Cafe", specialty: "Sambar idli", price: "Rs.120-400", location: "Triplicane" },
      { name: "Annalakshmi", specialty: "Vegetarian thali", price: "Rs.300-900", location: "Chetpet" },
    ],
    streetFood: [
      { name: "Marina Food Stalls", specialty: "Sundal and bajji", price: "Rs.40-180", location: "Marina Beach" },
      { name: "Sowcarpet Streets", specialty: "Chaat and sweets", price: "Rs.60-250", location: "Sowcarpet" },
    ],
    nearby: [
      { name: "Mahabalipuram", distance: "58 km", why: "UNESCO shore temples and sculptures." },
      { name: "Pulicat", distance: "60 km", why: "Lagoon and birding." },
    ],
  },
  {
    key: "madurai",
    overview: "Madurai is a temple city with deep heritage, markets, and famous Tamil food.",
    bestSeason: "October to March.",
    pois: [
      { name: "Meenakshi Amman Temple", description: "Grand temple architecture and rituals.", area: "Temple City Center", fee: 0 },
      { name: "Thirumalai Nayakkar Mahal", description: "17th-century palace hall.", area: "Madurai", fee: 50 },
      { name: "Gandhi Memorial Museum", description: "History and freedom movement archives.", area: "Tamukkam", fee: 0 },
      { name: "Alagar Kovil", description: "Hill temple setting.", area: "Alagar Hills", fee: 0 },
      { name: "Vandiyur Mariamman Teppakulam", description: "Temple tank and evening spot.", area: "Vandiyur", fee: 0 },
      { name: "Puthu Mandapam", description: "Textile and handicraft market.", area: "Near temple", fee: 0 },
      { name: "Samanar Hills", description: "Ancient cave inscriptions and views.", area: "Keelakuyilkudi", fee: 0 },
      { name: "Koodal Azhagar Temple", description: "Historic Vaishnavite temple.", area: "Madurai", fee: 0 },
    ],
    dishes: [
      { name: "Jigarthanda", description: "Madurai signature cold drink.", price: "Rs.50-150", where: "Town beverage shops", emoji: "" },
      { name: "Kari Dosa", description: "Stuffed dosa with meat masala.", price: "Rs.120-300", where: "Specialty eateries", emoji: "" },
      { name: "Parotta and Salna", description: "Popular evening meal.", price: "Rs.80-220", where: "Roadside and family hotels", emoji: "" },
    ],
    restaurants: [
      { name: "Murugan Idli", specialty: "Soft idli and podi", price: "Rs.150-450", location: "West Masi Street" },
      { name: "Amma Mess", specialty: "Non-veg Tamil meals", price: "Rs.250-900", location: "Near Mattuthavani" },
      { name: "Kumar Mess", specialty: "Local meat specialties", price: "Rs.300-900", location: "Madurai city" },
    ],
    streetFood: [
      { name: "Masi Street Stalls", specialty: "Parotta and snacks", price: "Rs.60-220", location: "Masi Streets" },
      { name: "Temple Area Bites", specialty: "Jigarthanda and sweets", price: "Rs.50-180", location: "Meenakshi Temple area" },
    ],
    nearby: [
      { name: "Rameswaram", distance: "170 km", why: "Temple town and sea bridge route." },
      { name: "Kodaikanal", distance: "120 km", why: "Hill station getaway." },
    ],
  },
  {
    key: "coimbatore",
    overview: "Coimbatore is a gateway city to the Western Ghats, temples, and textile hubs.",
    bestSeason: "October to March.",
    pois: [
      { name: "Marudamalai Temple", description: "Hill temple and city views.", area: "Marudamalai", fee: 0 },
      { name: "Perur Pateeswarar Temple", description: "Historic temple architecture.", area: "Perur", fee: 0 },
      { name: "VOC Park and Zoo", description: "Family park and mini-zoo.", area: "Town Hall", fee: 30 },
      { name: "Gass Forest Museum", description: "Natural history exhibits.", area: "RS Puram", fee: 20 },
      { name: "Isha Adiyogi", description: "Large Shiva statue and meditation center.", area: "Isha Yoga Center", fee: 0 },
      { name: "Brookefields Area", description: "Shopping and city food stops.", area: "RS Puram", fee: 0 },
      { name: "Siruvani Viewpoint", description: "Scenic foothill drive.", area: "Siruvani", fee: 0 },
      { name: "Kovai Kutralam", description: "Waterfall in reserve forest.", area: "Siruvani range", fee: 50 },
    ],
    dishes: [
      { name: "Kongunadu Chicken Curry", description: "Spicy regional curry.", price: "Rs.220-600", where: "Kongu specialty restaurants", emoji: "" },
      { name: "Arisi Paruppu Sadam", description: "Kongu comfort rice dish.", price: "Rs.120-280", where: "Local messes", emoji: "" },
      { name: "Kari Dosai", description: "Regional non-veg dosa style.", price: "Rs.130-320", where: "Tamil eateries", emoji: "" },
    ],
    restaurants: [
      { name: "Annapoorna", specialty: "South Indian tiffin", price: "Rs.150-500", location: "Gandhipuram / multiple branches" },
      { name: "Hari Bhavanam", specialty: "Kongu cuisine", price: "Rs.300-1000", location: "Peelamedu" },
      { name: "Sree Annapoorna Sree Gowrishankar", specialty: "Vegetarian meals", price: "Rs.180-550", location: "Town center" },
    ],
    streetFood: [
      { name: "Gandhipuram Stalls", specialty: "Evening snacks", price: "Rs.60-220", location: "Gandhipuram" },
      { name: "RS Puram Bites", specialty: "Quick local food", price: "Rs.80-250", location: "RS Puram" },
    ],
    nearby: [
      { name: "Valparai", distance: "105 km", why: "Tea estates and hairpin mountain drive." },
      { name: "Ooty", distance: "86 km", why: "Nilgiri hill station excursion." },
    ],
  },
  {
    key: "kodaikanal",
    overview: "Kodaikanal is a cool hill station with lake activities, viewpoints, and forest trails.",
    bestSeason: "October to June.",
    pois: [
      { name: "Kodai Lake", description: "Boating and cycle path.", area: "Kodaikanal", fee: 0 },
      { name: "Coaker's Walk", description: "Valley-view pedestrian path.", area: "Kodaikanal", fee: 30 },
      { name: "Pillar Rocks", description: "Iconic rock viewpoint.", area: "Kodaikanal", fee: 20 },
      { name: "Bryant Park", description: "Botanical garden stop.", area: "Near lake", fee: 30 },
      { name: "Silver Cascade Falls", description: "Roadside waterfall point.", area: "Kodaikanal Road", fee: 0 },
      { name: "Guna Caves (Devil's Kitchen)", description: "Pine forest and cave zone.", area: "Pillar Rocks Road", fee: 0 },
      { name: "Moir Point", description: "Mountain ridge viewpoint.", area: "Berijam Road", fee: 0 },
      { name: "Pine Forest", description: "Popular photo and walk spot.", area: "Kodaikanal", fee: 0 },
    ],
    dishes: [
      { name: "Homemade Chocolate", description: "Kodaikanal specialty confectionery.", price: "Rs.120-450", where: "Lake-side shops", emoji: "" },
      { name: "Hot Mushroom Pepper Fry", description: "Hill-climate comfort side.", price: "Rs.150-350", where: "Local restaurants", emoji: "" },
      { name: "Fresh Carrot Cake", description: "Bakery favorite in the hills.", price: "Rs.90-240", where: "Bakeries near lake", emoji: "" },
    ],
    restaurants: [
      { name: "Cloud Street", specialty: "Continental and pizza", price: "Rs.350-1100", location: "PT Road" },
      { name: "Tava", specialty: "Indian meals", price: "Rs.250-850", location: "Kodaikanal town" },
      { name: "Aby's Cafe", specialty: "Cafe food", price: "Rs.220-700", location: "Near lake" },
    ],
    streetFood: [
      { name: "Lake Road Stalls", specialty: "Corn and snacks", price: "Rs.50-180", location: "Kodai Lake" },
      { name: "PT Road Bites", specialty: "Quick evening food", price: "Rs.70-220", location: "PT Road" },
    ],
    nearby: [
      { name: "Berijam Lake", distance: "22 km", why: "Forest lake drive." },
      { name: "Palani", distance: "65 km", why: "Temple hill town." },
    ],
  },
  {
    key: "thanjavur",
    overview: "Thanjavur is a Chola heritage city known for temple architecture and classical arts.",
    bestSeason: "November to February.",
    pois: [
      { name: "Brihadeeswarar Temple", description: "UNESCO Chola temple masterpiece.", area: "Thanjavur", fee: 0 },
      { name: "Thanjavur Palace Complex", description: "Museum and royal heritage.", area: "Palace Road", fee: 50 },
      { name: "Saraswathi Mahal Library", description: "Historic manuscript library.", area: "Palace Complex", fee: 30 },
      { name: "Schwartz Church", description: "Colonial-era church.", area: "City center", fee: 0 },
      { name: "Art Plate Workshops", description: "Traditional Tanjore art crafts.", area: "Local artisan areas", fee: 0 },
      { name: "Sivaganga Park", description: "City park and family stop.", area: "Near temple", fee: 20 },
      { name: "Thanjavur Maratha Museum", description: "Sculpture and history collection.", area: "Palace", fee: 30 },
      { name: "Local Bronze Craft Lane", description: "Heritage metal craft shopping.", area: "Thanjavur market", fee: 0 },
    ],
    dishes: [
      { name: "Sambar Sadam", description: "Classic Tamil rice meal.", price: "Rs.100-240", where: "Messes and local restaurants", emoji: "" },
      { name: "Kumbakonam Degree Coffee", description: "Strong aromatic coffee.", price: "Rs.30-120", where: "Coffee stalls", emoji: "" },
      { name: "Poli", description: "Sweet flatbread dessert.", price: "Rs.40-140", where: "Sweet shops", emoji: "" },
    ],
    restaurants: [
      { name: "Sathars", specialty: "Tamil vegetarian meals", price: "Rs.150-500", location: "Thanjavur city" },
      { name: "Vasantha Bhavan", specialty: "South Indian tiffin", price: "Rs.120-450", location: "Main road" },
      { name: "Rice and Spice", specialty: "Local meals", price: "Rs.180-600", location: "Thanjavur center" },
    ],
    streetFood: [
      { name: "Temple Street Snacks", specialty: "Bajji and sweets", price: "Rs.40-160", location: "Near temple" },
      { name: "Market Road Bites", specialty: "Evening tiffin", price: "Rs.60-200", location: "Thanjavur market" },
    ],
    nearby: [
      { name: "Kumbakonam", distance: "40 km", why: "Temple circuit town." },
      { name: "Gangaikonda Cholapuram", distance: "70 km", why: "Chola temple heritage." },
    ],
  },
  {
    key: "trichy",
    overview: "Trichy combines river-island temples, rock fort heritage, and strong Tamil cuisine.",
    bestSeason: "November to February.",
    pois: [
      { name: "Rockfort Temple", description: "Historic hill fort and city views.", area: "Malaikottai", fee: 0 },
      { name: "Srirangam Ranganathaswamy Temple", description: "Large temple complex on island.", area: "Srirangam", fee: 0 },
      { name: "Jambukeswarar Temple", description: "Pancha Bhoota temple.", area: "Tiruvanaikaval", fee: 0 },
      { name: "Kallanai Dam", description: "Ancient Grand Anicut engineering site.", area: "Kallanai", fee: 0 },
      { name: "St. Joseph's Church", description: "Historic church landmark.", area: "Trichy", fee: 0 },
      { name: "Mukkombu", description: "River picnic and viewpoint.", area: "Upper Anaicut", fee: 30 },
      { name: "Railway Heritage Spot", description: "City transport history zone.", area: "Trichy", fee: 0 },
      { name: "Chathiram Market", description: "Busy shopping and snack area.", area: "Chathiram", fee: 0 },
    ],
    dishes: [
      { name: "Banana Leaf Meals", description: "Traditional Tamil lunch service.", price: "Rs.120-320", where: "Messes", emoji: "" },
      { name: "Kothu Parotta", description: "Popular evening street dish.", price: "Rs.100-260", where: "Street stalls", emoji: "" },
      { name: "Idiyappam", description: "Steamed string hoppers.", price: "Rs.80-220", where: "Breakfast shops", emoji: "" },
    ],
    restaurants: [
      { name: "A2B", specialty: "Tiffin and sweets", price: "Rs.150-500", location: "Trichy city" },
      { name: "Banana Leaf", specialty: "South Indian meals", price: "Rs.180-600", location: "Srirangam side" },
      { name: "Vasanta Bhavan", specialty: "Vegetarian tiffin", price: "Rs.120-450", location: "Main road" },
    ],
    streetFood: [
      { name: "Chathiram Street Stalls", specialty: "Kothu and snacks", price: "Rs.60-220", location: "Chathiram" },
      { name: "Srirangam Bites", specialty: "Temple-town quick meals", price: "Rs.60-200", location: "Srirangam" },
    ],
    nearby: [
      { name: "Thanjavur", distance: "60 km", why: "Chola heritage sites." },
      { name: "Karaikudi", distance: "90 km", why: "Chettinad architecture and cuisine." },
    ],
  },
  {
    key: "rameswaram",
    overview: "Rameswaram is a coastal pilgrimage town with iconic temple corridors and sea views.",
    bestSeason: "October to March.",
    pois: [
      { name: "Ramanathaswamy Temple", description: "Famous long temple corridors.", area: "Temple town", fee: 0 },
      { name: "Dhanushkodi", description: "Ghost town and beach point.", area: "Dhanushkodi", fee: 0 },
      { name: "Pamban Bridge View", description: "Sea bridge landmark.", area: "Pamban", fee: 0 },
      { name: "Agnitheertham", description: "Sacred seafront bathing ghat.", area: "Rameswaram coast", fee: 0 },
      { name: "Abdul Kalam Memorial", description: "Memorial and museum.", area: "Pei Karumbu", fee: 0 },
      { name: "Kothandaramaswamy Temple", description: "Historic temple near sea stretch.", area: "Dhanushkodi Road", fee: 0 },
      { name: "Five-faced Hanuman Temple", description: "Religious site with artifacts.", area: "Rameswaram", fee: 0 },
      { name: "Sea Shore Walk", description: "Sunrise and coastal breeze.", area: "Rameswaram beach", fee: 0 },
    ],
    dishes: [
      { name: "Fish Fry", description: "Fresh coastal seafood style.", price: "Rs.220-650", where: "Seafood restaurants", emoji: "" },
      { name: "Idiyappam with Coconut Milk", description: "Light Tamil breakfast.", price: "Rs.80-220", where: "Local hotels", emoji: "" },
      { name: "Nethili Fry", description: "Anchovy style local fry.", price: "Rs.180-450", where: "Coastal eateries", emoji: "" },
    ],
    restaurants: [
      { name: "Hotel Guru", specialty: "South Indian and seafood", price: "Rs.180-700", location: "Rameswaram town" },
      { name: "Ahaan Restaurant", specialty: "Family dining", price: "Rs.220-800", location: "Near temple roads" },
      { name: "Nattukottai", specialty: "Tamil meals", price: "Rs.180-650", location: "Rameswaram center" },
    ],
    streetFood: [
      { name: "Temple Road Snacks", specialty: "Tea and tiffin", price: "Rs.50-180", location: "Temple zone" },
      { name: "Pamban Side Bites", specialty: "Seafood quick bites", price: "Rs.80-240", location: "Pamban road" },
    ],
    nearby: [
      { name: "Dhanushkodi", distance: "20 km", why: "Land's end and beach stretch." },
      { name: "Devipattinam", distance: "70 km", why: "Coastal temple stop." },
    ],
  },
  {
    key: "kanyakumari",
    overview: "Kanyakumari offers sunrise-sunset views, coastal landmarks, and cultural monuments.",
    bestSeason: "October to March.",
    pois: [
      { name: "Vivekananda Rock Memorial", description: "Sea rock monument and ferry ride.", area: "Kanyakumari coast", fee: 70 },
      { name: "Thiruvalluvar Statue View", description: "Iconic offshore statue landmark.", area: "Kanyakumari", fee: 0 },
      { name: "Sunrise Point", description: "Popular dawn viewpoint.", area: "Beachfront", fee: 0 },
      { name: "Sunset Point", description: "Evening sea horizon view.", area: "Kanyakumari coast", fee: 0 },
      { name: "Kumari Amman Temple", description: "Historic coastal temple.", area: "Temple area", fee: 0 },
      { name: "Gandhi Mandapam", description: "Memorial near seafront.", area: "Kanyakumari", fee: 0 },
      { name: "Vattakottai Fort", description: "Sea-facing fort viewpoint.", area: "Vattakottai", fee: 0 },
      { name: "Padmanabhapuram Palace (nearby)", description: "Wooden palace architecture.", area: "Thuckalay", fee: 65 },
    ],
    dishes: [
      { name: "Nendran Chips", description: "Banana chips coastal snack.", price: "Rs.50-180", where: "Local shops", emoji: "" },
      { name: "Fish Curry Meal", description: "Coastal Tamil fish curry set.", price: "Rs.220-600", where: "Seafood eateries", emoji: "" },
      { name: "Parotta with Salna", description: "Popular Tamil dinner combo.", price: "Rs.90-240", where: "Roadside hotels", emoji: "" },
    ],
    restaurants: [
      { name: "The Curry", specialty: "South Indian and seafood", price: "Rs.250-900", location: "Kanyakumari town" },
      { name: "Seashore Restaurant", specialty: "Sea-view dining", price: "Rs.300-1000", location: "Beach Road" },
      { name: "Hotel Saravana", specialty: "Vegetarian meals", price: "Rs.150-500", location: "Near bus stand" },
    ],
    streetFood: [
      { name: "Beach Road Stalls", specialty: "Snacks and tea", price: "Rs.50-180", location: "Kanyakumari beach" },
      { name: "Temple Street Bites", specialty: "Local tiffin", price: "Rs.60-200", location: "Temple area" },
    ],
    nearby: [
      { name: "Nagercoil", distance: "20 km", why: "City markets and local cuisine." },
      { name: "Suchindram", distance: "13 km", why: "Historic temple architecture." },
    ],
  },
  {
    key: "mahabalipuram",
    overview: "Mahabalipuram is known for UNESCO rock-cut temples and coastal heritage monuments.",
    bestSeason: "November to February.",
    pois: [
      { name: "Shore Temple", description: "UNESCO seafront temple complex.", area: "Mahabalipuram", fee: 40 },
      { name: "Pancha Rathas", description: "Monolithic rock-cut architecture.", area: "Mahabalipuram", fee: 40 },
      { name: "Arjuna's Penance", description: "Giant open-air bas-relief panel.", area: "Town center", fee: 0 },
      { name: "Krishna's Butter Ball", description: "Iconic natural rock formation.", area: "Hill area", fee: 0 },
      { name: "Mahishamardini Cave", description: "Ancient cave carvings.", area: "Near lighthouse", fee: 0 },
      { name: "Lighthouse Viewpoint", description: "Coastal panoramic view.", area: "Mahabalipuram", fee: 30 },
      { name: "Tiger Cave", description: "Rock-cut cave temple site.", area: "Saluvankuppam", fee: 25 },
      { name: "Beach Walk", description: "Evening shore relaxation.", area: "Mahabalipuram beach", fee: 0 },
    ],
    dishes: [
      { name: "Seafood Platter", description: "Fresh catch coastal spread.", price: "Rs.350-1200", where: "Beach restaurants", emoji: "" },
      { name: "Kothu Parotta", description: "Popular Tamil street meal.", price: "Rs.100-260", where: "Town eateries", emoji: "" },
      { name: "Filter Coffee", description: "South Indian coffee staple.", price: "Rs.30-120", where: "Cafe stalls", emoji: "" },
    ],
    restaurants: [
      { name: "Moonrakers", specialty: "Seafood", price: "Rs.350-1200", location: "Beach area" },
      { name: "Nautilus", specialty: "Multi-cuisine", price: "Rs.300-1000", location: "Othavadai Street" },
      { name: "The Wharf", specialty: "Coastal dining", price: "Rs.500-1500", location: "ECR resort zone" },
    ],
    streetFood: [
      { name: "Beach Stalls", specialty: "Fried seafood and snacks", price: "Rs.80-260", location: "Beachfront" },
      { name: "Temple Street Bites", specialty: "Tiffin and tea", price: "Rs.50-180", location: "Town center" },
    ],
    nearby: [
      { name: "Chennai", distance: "58 km", why: "Metro day visit." },
      { name: "Puducherry", distance: "95 km", why: "French quarter and beach cafes." },
    ],
  },
  {
    key: "salem",
    overview: "Salem is a central Tamil Nadu hub with temples, hill drives, textile markets, and food streets.",
    bestSeason: "November to February.",
    pois: [
      { name: "Yercaud Day Drive", description: "Quick hill escape from Salem city.", area: "Yercaud Ghat Road", fee: 0 },
      { name: "1008 Lingam Temple", description: "Temple complex with panoramic views.", area: "Ariyanoor", fee: 0 },
      { name: "Kurumbapatti Zoo", description: "Family-friendly green zone.", area: "Kurumbapatti", fee: 40 },
      { name: "Mookaneri Lake", description: "Sunset and jogging track.", area: "Salem city", fee: 0 },
      { name: "Sugavaneswarar Temple", description: "Historic temple in city core.", area: "Salem Town", fee: 0 },
      { name: "Shevapet Market", description: "Local textile and provisions market.", area: "Shevapet", fee: 0 },
      { name: "Kottai Mariamman Temple", description: "Popular temple and local bazaar belt.", area: "Fort area", fee: 0 },
      { name: "Anna Park", description: "Relaxed evening walk spot.", area: "Hasthampatti", fee: 20 },
    ],
    dishes: [
      { name: "Thattu Vadai Set", description: "Salem's famous layered snack.", price: "Rs.40-120", where: "Local snack shops", emoji: "food" },
      { name: "Kari Dosa", description: "Regional non-veg dosa style.", price: "Rs.130-320", where: "City eateries", emoji: "food" },
      { name: "Parotta Salna", description: "Popular evening street combo.", price: "Rs.90-240", where: "Roadside hotels", emoji: "food" },
    ],
    restaurants: [
      { name: "Selvi Mess", specialty: "Tamil meals and biryani", price: "Rs.180-700", location: "Salem Junction belt" },
      { name: "Rasikaas", specialty: "Vegetarian tiffin and meals", price: "Rs.150-550", location: "Five Roads" },
      { name: "Junior Kuppanna", specialty: "Kongu non-veg", price: "Rs.250-900", location: "Multiple Salem branches" },
    ],
    streetFood: [
      { name: "Leigh Bazaar Bites", specialty: "Tea-time snacks", price: "Rs.50-180", location: "Leigh Bazaar" },
      { name: "Saradha College Road Stalls", specialty: "Night tiffin", price: "Rs.70-220", location: "Salem city" },
    ],
    nearby: [
      { name: "Yercaud", distance: "30 km", why: "Hill station with viewpoints and lake." },
      { name: "Namakkal", distance: "55 km", why: "Fort hill and temple stop." },
    ],
  },
  {
    key: "yercaud",
    overview: "Yercaud is an easy Tamil Nadu hill station known for viewpoints, lake boating, and coffee estates.",
    bestSeason: "October to June.",
    pois: [
      { name: "Yercaud Lake", description: "Boating and lakeside strolls.", area: "Town center", fee: 50 },
      { name: "Pagoda Point", description: "Sunrise valley viewpoint.", area: "Yercaud Hills", fee: 0 },
      { name: "Lady's Seat", description: "Classic sunset cliff edge.", area: "Yercaud", fee: 0 },
      { name: "Kiliyur Falls View", description: "Seasonal waterfall and trek descent.", area: "Kiliyur", fee: 0 },
      { name: "Botanical Garden", description: "Orchids and hill flora.", area: "Yercaud", fee: 30 },
      { name: "Shevaroy Temple", description: "Hilltop cave temple.", area: "Servarayan Peak", fee: 0 },
      { name: "Anna Park", description: "Flower beds and town-center leisure.", area: "Yercaud", fee: 15 },
      { name: "Coffee Estate Walk", description: "Plantation trail and tasting.", area: "Estate belt", fee: 100 },
    ],
    dishes: [
      { name: "Pepper Chicken", description: "Spicy hill-station favorite.", price: "Rs.220-600", where: "Local restaurants", emoji: "food" },
      { name: "Mushroom Fry", description: "Fresh local produce preparation.", price: "Rs.150-380", where: "Town eateries", emoji: "food" },
      { name: "Filter Coffee", description: "Estate-style brew.", price: "Rs.40-140", where: "Cafe stalls", emoji: "food" },
    ],
    restaurants: [
      { name: "GRT Nature Trails Dining", specialty: "Resort cuisine", price: "Rs.350-1200", location: "Yercaud main road" },
      { name: "Sweet Rascal", specialty: "Cafe and continental", price: "Rs.250-850", location: "Near lake road" },
      { name: "Altitudes", specialty: "Indian and grill", price: "Rs.300-1000", location: "Town center" },
    ],
    streetFood: [
      { name: "Lake Road Stalls", specialty: "Corn and tea", price: "Rs.40-160", location: "Yercaud Lake" },
      { name: "Town Center Tiffin", specialty: "Evening snacks", price: "Rs.60-200", location: "Yercaud market" },
    ],
    nearby: [
      { name: "Salem", distance: "30 km", why: "City shopping and transit hub." },
      { name: "Mettur", distance: "75 km", why: "Dam viewpoints and reservoir drive." },
    ],
  },
  {
    key: "tirunelveli",
    overview: "Tirunelveli blends temple history, riverfront culture, halwa heritage, and southern Tamil circuits.",
    bestSeason: "November to February.",
    pois: [
      { name: "Nellaiappar Temple", description: "Large temple complex with musical pillars.", area: "Tirunelveli Town", fee: 0 },
      { name: "Kanthimathi Temple Corridor", description: "Historic temple architecture.", area: "Temple zone", fee: 0 },
      { name: "Tamirabarani Riverside", description: "Evening local walk stretch.", area: "River belt", fee: 0 },
      { name: "Manimuthar Dam View", description: "Scenic dam and foothill stop.", area: "Manimuthar", fee: 0 },
      { name: "Papanasam Circuit", description: "Temple and nature day trip.", area: "Papanasam", fee: 0 },
      { name: "District Science Centre", description: "Family-friendly exhibit center.", area: "Tirunelveli", fee: 30 },
      { name: "Palayamkottai Market", description: "Local shopping and snacks.", area: "Palayamkottai", fee: 0 },
      { name: "Archaeological Museum", description: "Regional artifacts and history.", area: "Tirunelveli", fee: 20 },
    ],
    dishes: [
      { name: "Tirunelveli Halwa", description: "City's iconic sweet.", price: "Rs.120-400", where: "Traditional sweet shops", emoji: "food" },
      { name: "Sodhi Kuzhambu Meal", description: "South Tamil home-style curry meal.", price: "Rs.140-320", where: "Meals hotels", emoji: "food" },
      { name: "Kothu Parotta", description: "Popular evening street dish.", price: "Rs.100-260", where: "Night stalls", emoji: "food" },
    ],
    restaurants: [
      { name: "Iruttukadai Halwa", specialty: "Legendary halwa", price: "Rs.150-500", location: "Nellai Town" },
      { name: "Aryaas", specialty: "South Indian meals", price: "Rs.140-500", location: "Palayamkottai" },
      { name: "Hotel Sree Saravana Bhavan", specialty: "Tiffin and meals", price: "Rs.120-420", location: "Junction area" },
    ],
    streetFood: [
      { name: "Junction Night Bites", specialty: "Parotta and grills", price: "Rs.80-240", location: "Tirunelveli Junction" },
      { name: "Palayamkottai Snack Rows", specialty: "Bajji and tea", price: "Rs.50-180", location: "Market roads" },
    ],
    nearby: [
      { name: "Courtallam", distance: "65 km", why: "Waterfalls and seasonal bath points." },
      { name: "Kanyakumari", distance: "85 km", why: "Sunrise-sunset coastal circuit." },
    ],
  },
  {
    key: "kanchipuram",
    overview: "Kanchipuram is a temple city known for silk weaving clusters and heritage architecture.",
    bestSeason: "November to February.",
    pois: [
      { name: "Ekambareswarar Temple", description: "Massive temple complex with ancient mango tree.", area: "Kanchipuram", fee: 0 },
      { name: "Kailasanathar Temple", description: "Pallava-era sandstone architecture.", area: "Kanchipuram", fee: 0 },
      { name: "Varadharaja Perumal Temple", description: "Major Vaishnavite shrine.", area: "Little Kanchi", fee: 0 },
      { name: "Kamakshi Amman Temple", description: "Prominent Shakti temple.", area: "Big Kanchi", fee: 0 },
      { name: "Silk Weaver Street", description: "Handloom and saree shopping stretch.", area: "Silk market", fee: 0 },
      { name: "Kanchi Kudil", description: "Traditional Tamil house museum.", area: "Kanchipuram", fee: 20 },
      { name: "Ulagalanda Perumal Temple", description: "Historic temple with large Vishnu idol.", area: "Town center", fee: 0 },
      { name: "Sarvatirtha Tank Walk", description: "Calm local evening stop.", area: "Kanchipuram", fee: 0 },
    ],
    dishes: [
      { name: "Kanchipuram Idli", description: "Spiced temple-style idli.", price: "Rs.60-180", where: "Traditional tiffin shops", emoji: "food" },
      { name: "Puliyodarai", description: "Temple tamarind rice specialty.", price: "Rs.80-220", where: "Temple prasad counters", emoji: "food" },
      { name: "Filter Coffee", description: "Classic South Indian finish.", price: "Rs.30-120", where: "Town cafes", emoji: "food" },
    ],
    restaurants: [
      { name: "Saravana Bhavan", specialty: "Tiffin and vegetarian meals", price: "Rs.120-450", location: "Kanchipuram center" },
      { name: "Sangeetha", specialty: "South Indian cuisine", price: "Rs.140-500", location: "Temple belt" },
      { name: "Adyar Ananda Bhavan", specialty: "Snacks and sweets", price: "Rs.120-450", location: "Main road" },
    ],
    streetFood: [
      { name: "Temple Street Tiffin", specialty: "Mini tiffin and tea", price: "Rs.50-180", location: "Temple quarters" },
      { name: "Silk Market Snacks", specialty: "Bajji and sweets", price: "Rs.60-200", location: "Weaver lanes" },
    ],
    nearby: [
      { name: "Mahabalipuram", distance: "67 km", why: "UNESCO shore monuments." },
      { name: "Chennai", distance: "75 km", why: "Metro add-on and museums." },
    ],
  },
  {
    key: "tamilnadu",
    overview: "Tamil Nadu offers temples, beaches, hill stations, and rich regional cuisines across districts.",
    bestSeason: "November to February for most circuits.",
    pois: [
      { name: "State Heritage Circuit", description: "Major temple and cultural trail points.", area: "Across Tamil Nadu", fee: 0 },
      { name: "Coastal Circuit", description: "Beach towns and sea-facing heritage.", area: "East Coast", fee: 0 },
      { name: "Hill Circuit", description: "Nilgiri and Palani hill destinations.", area: "Western Ghats", fee: 0 },
      { name: "Temple Architecture Trail", description: "Dravidian temple complexes.", area: "Various districts", fee: 0 },
      { name: "Local Market Walk", description: "Textiles, bronze, and handicrafts.", area: "City markets", fee: 0 },
      { name: "Classical Arts Venue", description: "Music and dance programs.", area: "Major cities", fee: 0 },
      { name: "Cuisine Trail", description: "Regional tiffin and meals exploration.", area: "Tamil Nadu", fee: 0 },
      { name: "Sunrise/Sunset Spot", description: "Coastal or hill viewpoint.", area: "Selected route", fee: 0 },
    ],
    dishes: [
      { name: "Tamil Meals", description: "Banana-leaf full meal.", price: "Rs.150-380", where: "Local messes", emoji: "" },
      { name: "Dosa Variety", description: "Tiffin staple across regions.", price: "Rs.80-240", where: "Tiffin centers", emoji: "" },
      { name: "Filter Coffee", description: "Signature beverage.", price: "Rs.30-120", where: "Coffee shops", emoji: "" },
    ],
    restaurants: [
      { name: "A2B / Adyar Ananda Bhavan", specialty: "South Indian and sweets", price: "Rs.150-500", location: "Multiple cities" },
      { name: "Murugan Idli", specialty: "Classic tiffin", price: "Rs.120-420", location: "Major TN cities" },
      { name: "Regional Mess", specialty: "Authentic local meals", price: "Rs.150-500", location: "City centers" },
    ],
    streetFood: [
      { name: "City Night Stalls", specialty: "Parotta and snacks", price: "Rs.60-220", location: "Urban markets" },
      { name: "Temple-town Bites", specialty: "Sweets and tiffin", price: "Rs.50-200", location: "Temple zones" },
    ],
    nearby: [
      { name: "Puducherry", distance: "Route dependent", why: "Colonial quarter and coast." },
      { name: "Hogenakkal", distance: "Route dependent", why: "Waterfalls and coracle rides." },
    ],
  },
];

function defaultProfile(dest: string): DestinationProfile {
  return {
    key: "default",
    overview: `${dest} offers cultural landmarks, local food, and day-trip options.`,
    bestSeason: "October to March.",
    pois: [
      { name: `${dest} City Center`, description: "Primary sightseeing zone.", area: dest, fee: 0 },
      { name: `${dest} Main Market`, description: "Local shopping and food.", area: dest, fee: 0 },
      { name: `${dest} Heritage Site`, description: "Popular cultural spot.", area: dest, fee: 100 },
      { name: `${dest} Riverside / Lakefront`, description: "Leisure evening area.", area: dest, fee: 0 },
      { name: `${dest} Museum`, description: "History and local artifacts.", area: dest, fee: 80 },
      { name: `${dest} Viewpoint`, description: "City panorama and photos.", area: dest, fee: 50 },
      { name: `${dest} Temple / Shrine`, description: "Cultural visit.", area: dest, fee: 0 },
      { name: `${dest} Park`, description: "Relaxed nature break.", area: dest, fee: 20 },
    ],
    dishes: [
      { name: "Regional Thali", description: "Signature local meal spread.", price: "Rs.180-450", where: `${dest} traditional eateries`, emoji: "" },
      { name: "Popular Street Snack", description: "Local quick bite.", price: "Rs.40-180", where: `${dest} market area`, emoji: "" },
      { name: "Local Dessert", description: "Traditional sweet specialty.", price: "Rs.60-220", where: `${dest} sweet shops`, emoji: "" },
    ],
    restaurants: [
      { name: `${dest} Local Kitchen`, specialty: "Regional dishes", price: "Rs.300-900", location: `${dest} center` },
      { name: `${dest} Spice House`, specialty: "Indian meals", price: "Rs.300-850", location: `${dest} central district` },
      { name: `${dest} Food Court`, specialty: "Mixed cuisines", price: "Rs.250-700", location: `${dest} market road` },
    ],
    streetFood: [
      { name: `${dest} Street Market`, specialty: "Snacks and chai", price: "Rs.60-220", location: `${dest} old market` },
      { name: `${dest} Night Bites`, specialty: "Evening food stalls", price: "Rs.80-250", location: `${dest} downtown` },
    ],
    nearby: [
      { name: `Near ${dest} Site 1`, distance: "60 km", why: "Good half-day escape." },
      { name: `Near ${dest} Site 2`, distance: "110 km", why: "Popular scenic add-on." },
    ],
  };
}

function getProfile(destination: string): DestinationProfile {
  const key = normalizeCity(destination);
  const aliasKey = DESTINATION_ALIASES[key];
  if (aliasKey) {
    const aliasMatch = PROFILES.find((p) => p.key === aliasKey);
    if (aliasMatch) {
      return aliasMatch;
    }
  }
  const matched = PROFILES.find((p) => key.includes(p.key) || p.key.includes(key));
  return matched || defaultProfile(destination);
}

export function buildFallbackPlan(data: TripFormData) {
  const profile = getProfile(data.destination);
  const transportMode: "flight" | "train" | "bus" | "car" =
    data.transport === "auto" ? "train" : data.transport;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const days = Math.min(10, Math.max(2, nights + 1));
  const transportBudget = Math.round(data.budget * 0.22);
  const hotelBudget = Math.round(data.budget * 0.34);
  const foodBudget = Math.round(data.budget * 0.2);
  const sightseeingBudget = Math.round(data.budget * 0.11);
  const localTransportBudget = Math.round(data.budget * 0.08);
  const miscBudget = Math.max(
    1000,
    data.budget -
      (transportBudget +
        hotelBudget +
        foodBudget +
        sightseeingBudget +
        localTransportBudget)
  );
  const extraPois: POI[] = profile.nearby.map((n) => ({
    name: `${n.name} Day Excursion`,
    description: n.why,
    area: `${n.name} (${n.distance})`,
    fee: 0,
  }));
  const combinedCatalog = [...profile.pois, ...extraPois];
  const seen = new Set<string>();
  const expandedPois: POI[] = [];
  for (const p of combinedCatalog) {
    const k = p.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    expandedPois.push(p);
  }
  const itinerary = Array.from({ length: days }, (_, i) => {
    const take = (idx: number) => expandedPois[idx % Math.max(1, expandedPois.length)];
    const m1 = take(i * 6);
    const m2 = take(i * 6 + 1);
    const a1 = take(i * 6 + 2);
    const a2 = take(i * 6 + 3);
    const e1 = take(i * 6 + 4);
    const e2 = take(i * 6 + 5);
    const rest = profile.restaurants[i % profile.restaurants.length];
    return {
      day: i + 1,
      date: addDays(data.startDate, i),
      theme:
        i === 0
          ? `Arrival and ${profile.key.toUpperCase()} Highlights`
          : `${profile.key.toUpperCase()} Explorer - Day ${i + 1}`,
      morning: {
        activity: `${m1.name} and ${m2.name}`,
        description: `${m1.description} Then continue to ${m2.description}`,
        location: `${m1.area} and ${m2.area}`,
        duration: "3-4 hours",
        entry_fee: m1.fee + m2.fee,
        tips: "Start early to avoid crowd peaks.",
      },
      afternoon: {
        activity: `${a1.name} and ${a2.name}`,
        description: `${a1.description} Then visit ${a2.description}`,
        location: `${a1.area} and ${a2.area}`,
        duration: "3-4 hours",
        entry_fee: a1.fee + a2.fee,
        tips: "Keep transport buffer between locations.",
      },
      evening: {
        activity: `${e1.name} and ${e2.name}`,
        description: `${e1.description} Wrap up with ${e2.description}`,
        location: `${e1.area} and ${e2.area}`,
        duration: "2-3 hours",
        entry_fee: e1.fee + e2.fee,
        tips: "Check local closing times for evening slots.",
      },
      food_suggestion: `${rest.name} - ${rest.specialty}`,
      local_transport_cost: Math.round(localTransportBudget / days),
    };
  });

  return {
    summary: `${data.source} to ${data.destination} trip for ${data.travelers} traveler(s) in ${data.mode} mode, with destination-special activities and food.`,
    destination_overview: profile.overview,
    best_time_to_visit: profile.bestSeason,
    weather: "Check live forecast before daily departures.",
    transport: {
      recommended: {
        mode: transportMode,
        operator: "Popular operator",
        departure: "07:00",
        arrival: "12:00",
        duration: "5h",
        price_per_person: Math.round(transportBudget / data.travelers),
        total_price: transportBudget,
        comfort: "High",
        stops: 0,
        badge: "Recommended",
        notes: fallbackTransportNotes(data.source, data.destination, transportMode, transportBudget),
      },
      bus: {
        mode: "bus",
        operator: "Budget operator",
        departure: "22:00",
        arrival: "08:00",
        duration: "10h",
        price_per_person: Math.round((transportBudget * 0.65) / data.travelers),
        total_price: Math.round(transportBudget * 0.65),
        comfort: "Medium",
        stops: 1,
        badge: "Bus",
        notes: fallbackTransportNotes(data.source, data.destination, "bus", Math.round(transportBudget * 0.65)),
      },
      train: {
        mode: "train",
        operator: "Rail operator",
        departure: "21:00",
        arrival: "07:00",
        duration: "10h",
        price_per_person: Math.round((transportBudget * 0.8) / data.travelers),
        total_price: Math.round(transportBudget * 0.8),
        comfort: "High",
        stops: 0,
        badge: "Train",
        notes: fallbackTransportNotes(data.source, data.destination, "train", Math.round(transportBudget * 0.8)),
      },
      flight: {
        mode: "flight",
        operator: "Fast operator",
        departure: "09:00",
        arrival: "11:00",
        duration: "2h",
        price_per_person: Math.round((transportBudget * 1.25) / data.travelers),
        total_price: Math.round(transportBudget * 1.25),
        comfort: "High",
        stops: 0,
        badge: "Flight",
        notes: fallbackTransportNotes(data.source, data.destination, "flight", Math.round(transportBudget * 1.25)),
      },
    },
    hotels: [
      {
        name: `${data.destination} Budget Stay`,
        category: "Budget",
        rating: 3.9,
        reviews: 840,
        price_per_night: Math.round(hotelBudget * 0.2),
        total_cost: Math.round(hotelBudget * 0.2) * nights,
        location: `${data.destination} central area`,
        amenities: ["WiFi", "AC", "Hot Water"],
        highlights: "Good value for low-cost travelers.",
        badge: "Budget Pick",
      },
      {
        name: `${data.destination} Comfort Hotel`,
        category: "Recommended",
        rating: 4.3,
        reviews: 1600,
        price_per_night: Math.round(hotelBudget * 0.3),
        total_cost: Math.round(hotelBudget * 0.3) * nights,
        location: `${data.destination} prime area`,
        amenities: ["WiFi", "Breakfast", "AC", "Parking"],
        highlights: "Balanced comfort and location.",
        badge: "Best Value",
      },
      {
        name: `${data.destination} Grand Resort`,
        category: "Premium",
        rating: 4.6,
        reviews: 2200,
        price_per_night: Math.round(hotelBudget * 0.45),
        total_cost: Math.round(hotelBudget * 0.45) * nights,
        location: `${data.destination} premium district`,
        amenities: ["WiFi", "Pool", "Spa", "Gym", "Restaurant"],
        highlights: "Premium stay with better facilities.",
        badge: "Luxury",
      },
    ],
    itinerary,
    food: {
      must_try_dishes: profile.dishes.map((d) => ({
        name: d.name,
        description: d.description,
        price_range: d.price,
        where_to_find: d.where,
        emoji: d.emoji,
      })),
      top_restaurants: profile.restaurants.map((r, i) => ({
        name: r.name,
        cuisine: "Local / Regional",
        rating: Number((4.1 + i * 0.1).toFixed(1)),
        price_range: `${r.price} per person`,
        specialty: r.specialty,
        address: r.location,
      })),
      street_food_spots: profile.streetFood.map((s) => ({
        name: s.name,
        specialty: s.specialty,
        price_range: s.price,
        location: s.location,
      })),
    },
    budget: {
      transport: transportBudget,
      hotel: hotelBudget,
      food: foodBudget,
      sightseeing: sightseeingBudget,
      local_transport: localTransportBudget,
      miscellaneous: miscBudget,
      grand_total: data.budget,
      per_person: Math.round(data.budget / data.travelers),
      savings_tips: [
        "Book transport and hotels 2-3 weeks early.",
        "Use local public/city transport where practical.",
        "Keep one flexible slot for weather changes.",
      ],
    },
    travel_tips: [
      "Carry valid ID and digital payment backup.",
      "Check opening days/hours of major attractions.",
      "Keep emergency contacts and hotel details offline.",
    ],
    nearby_destinations: profile.nearby.map((n) => ({
      name: n.name,
      distance: n.distance,
      why_visit: n.why,
    })),
    peak_season_warning: "Expect higher rates during weekends and holidays.",
    crowd_prediction: "Medium",
  };
}

