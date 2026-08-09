// Region catalogue + resolution.
//
// VenTrack serves the United Kingdom and nothing else, so every region in here is
// a UK town or city. A request resolves to a *region* first, and each region
// has its own source list and its own cache entry.
//
// There are no generic "anywhere on earth" cells: a coordinate that is nowhere
// near the UK falls back to London rather than minting a cache entry for a
// market we don't cover.
import { distanceKm } from "./util.js";

// Sources available per region. Keys map to SOURCE_IMPL in server.js.
// - ticketmaster: queried by lat/lng, scoped to countryCode=GB
// - skiddle:      UK listings service, queried by lat/lng (needs a free key)
// - fixtures:     upcoming football fixtures (needs a free key)
// - predicthq:    events intelligence feed, concerts to community listings
//                 (needs a free key)
// - eventbrite:   scraped per eventbrite.co.uk town slug
// - curated:      built-in guide of UK venues near the region
// - carboots:     built-in table of UK car boot sales, expanded into dates
// - spotted:      events users sent in, once published. Listed last so a
//                 ticketed copy of the same event always wins the de-dupe.
//
// Every UK region runs all eight. The keyed sources return nothing at all when
// their key is unset, so the app still works with none configured. Eventbrite
// is a per-town scrape, and a town with no Eventbrite page simply contributes
// nothing rather than failing the request.
//
// Order here is also de-dupe priority: server.js collapses events that share a
// title and a day, keeping whichever source hit first. Ticketmaster and
// Skiddle carry a real ticket link and price, so they are listed ahead of
// PredictHQ, which carries neither, so that a duplicate resolves to the more
// useful copy of the two.
const UK_SOURCES = ["ticketmaster", "skiddle", "fixtures", "predicthq", "eventbrite", "curated", "carboots", "spotted"];

// A UK region. Every entry carries the county / council area / principal area
// it sits in, and the nation, so the app's picker can group several hundred
// towns into something a person can actually scan.
//
// Coverage is deliberately at least one entry per ceremonial county in
// England, per principal area in Wales, per council area in Scotland and per
// traditional county in Northern Ireland, plus the larger cities and towns
// people actually search for.
function uk(nation, area, id, label, lat, lng, slug) {
  return {
    id,
    label,
    area,     // ceremonial county / council area / principal area
    nation,   // England | Wales | Scotland | Northern Ireland
    country: "GB",
    timeZone: "Europe/London",
    unit: "mi",
    lat,
    lng,
    radiusKm: 50,   // how far each source searches
    claimKm: 120,   // how close a user must be for this city to own them
    sources: UK_SOURCES,
    eventbrite: { host: "www.eventbrite.co.uk", slug: `united-kingdom--${slug}` },
  };
}

const eng = (area, id, label, lat, lng, slug) => uk("England", area, id, label, lat, lng, slug);
const wal = (area, id, label, lat, lng, slug) => uk("Wales", area, id, label, lat, lng, slug);
const sco = (area, id, label, lat, lng, slug) => uk("Scotland", area, id, label, lat, lng, slug);
const nir = (area, id, label, lat, lng, slug) => uk("Northern Ireland", area, id, label, lat, lng, slug);

export const CITIES = [
  // ---- England ------------------------------------------------------------
  // London first, so picking "United Kingdom" in the app lands there.
  eng("Greater London", "london", "London", 51.5074, -0.1278, "london"),
  eng("Greater Manchester", "manchester", "Manchester", 53.4808, -2.2426, "manchester"),
  eng("West Midlands", "birmingham", "Birmingham", 52.4862, -1.8904, "birmingham"),
  eng("West Midlands", "coventry", "Coventry", 52.4068, -1.5197, "coventry"),
  eng("West Midlands", "wolverhampton", "Wolverhampton", 52.5862, -2.1288, "wolverhampton"),
  eng("West Yorkshire", "leeds", "Leeds", 53.8008, -1.5491, "leeds"),
  eng("West Yorkshire", "bradford", "Bradford", 53.7960, -1.7594, "bradford"),
  eng("West Yorkshire", "huddersfield", "Huddersfield", 53.6450, -1.7798, "huddersfield"),
  eng("Merseyside", "liverpool", "Liverpool", 53.4084, -2.9916, "liverpool"),
  eng("South Yorkshire", "sheffield", "Sheffield", 53.3811, -1.4701, "sheffield"),
  eng("South Yorkshire", "doncaster", "Doncaster", 53.5228, -1.1285, "doncaster"),
  eng("Nottinghamshire", "nottingham", "Nottingham", 52.9548, -1.1581, "nottingham"),
  eng("Bristol", "bristol", "Bristol", 51.4545, -2.5879, "bristol"),
  eng("East Sussex", "brighton", "Brighton", 50.8225, -0.1372, "brighton"),
  eng("Hampshire", "southampton", "Southampton", 50.9097, -1.4044, "southampton"),
  eng("Hampshire", "portsmouth", "Portsmouth", 50.8058, -1.0872, "portsmouth"),
  eng("Devon", "plymouth", "Plymouth", 50.3755, -4.1427, "plymouth"),
  eng("Devon", "exeter", "Exeter", 50.7184, -3.5339, "exeter"),
  eng("Norfolk", "norwich", "Norwich", 52.6309, 1.2974, "norwich"),
  eng("Tyne and Wear", "newcastle", "Newcastle upon Tyne", 54.9783, -1.6178, "newcastle-upon-tyne"),
  eng("Tyne and Wear", "sunderland", "Sunderland", 54.9061, -1.3813, "sunderland"),
  eng("Bedfordshire", "luton", "Luton", 51.8787, -0.4200, "luton"),
  eng("Berkshire", "reading", "Reading", 51.4543, -0.9781, "reading"),
  eng("Buckinghamshire", "milton-keynes", "Milton Keynes", 52.0406, -0.7594, "milton-keynes"),
  eng("Cambridgeshire", "cambridge", "Cambridge", 52.2053, 0.1218, "cambridge"),
  eng("Cheshire", "chester", "Chester", 53.1934, -2.8931, "chester"),
  eng("Cornwall", "truro", "Truro", 50.2632, -5.0510, "truro"),
  eng("Cumbria", "carlisle", "Carlisle", 54.8925, -2.9329, "carlisle"),
  eng("Derbyshire", "derby", "Derby", 52.9225, -1.4746, "derby"),
  eng("Dorset", "bournemouth", "Bournemouth", 50.7192, -1.8808, "bournemouth"),
  eng("County Durham", "durham", "Durham", 54.7767, -1.5757, "durham"),
  eng("East Riding of Yorkshire", "hull", "Kingston upon Hull", 53.7676, -0.3274, "kingston-upon-hull"),
  eng("Essex", "chelmsford", "Chelmsford", 51.7356, 0.4685, "chelmsford"),
  eng("Essex", "southend", "Southend-on-Sea", 51.5459, 0.7077, "southend-on-sea"),
  eng("Gloucestershire", "gloucester", "Gloucester", 51.8642, -2.2380, "gloucester"),
  eng("Gloucestershire", "cheltenham", "Cheltenham", 51.8994, -2.0783, "cheltenham"),
  eng("Herefordshire", "hereford", "Hereford", 52.0567, -2.7160, "hereford"),
  eng("Hertfordshire", "watford", "Watford", 51.6565, -0.3903, "watford"),
  eng("Hertfordshire", "st-albans", "St Albans", 51.7520, -0.3360, "st-albans"),
  eng("Isle of Wight", "newport-iow", "Newport, Isle of Wight", 50.7014, -1.2880, "newport"),
  eng("Kent", "canterbury", "Canterbury", 51.2802, 1.0789, "canterbury"),
  eng("Kent", "maidstone", "Maidstone", 51.2704, 0.5227, "maidstone"),
  eng("Lancashire", "preston", "Preston", 53.7632, -2.7031, "preston"),
  eng("Lancashire", "blackpool", "Blackpool", 53.8175, -3.0357, "blackpool"),
  eng("Leicestershire", "leicester", "Leicester", 52.6369, -1.1398, "leicester"),
  eng("Lincolnshire", "lincoln", "Lincoln", 53.2307, -0.5406, "lincoln"),
  eng("North Yorkshire", "york", "York", 53.9600, -1.0873, "york"),
  eng("North Yorkshire", "harrogate", "Harrogate", 53.9921, -1.5418, "harrogate"),
  eng("Northamptonshire", "northampton", "Northampton", 52.2405, -0.9027, "northampton"),
  eng("Northumberland", "morpeth", "Morpeth", 55.1683, -1.6900, "morpeth"),
  eng("Oxfordshire", "oxford", "Oxford", 51.7520, -1.2577, "oxford"),
  eng("Rutland", "oakham", "Oakham", 52.6706, -0.7300, "oakham"),
  eng("Shropshire", "shrewsbury", "Shrewsbury", 52.7069, -2.7527, "shrewsbury"),
  eng("Shropshire", "telford", "Telford", 52.6784, -2.4453, "telford"),
  eng("Somerset", "taunton", "Taunton", 51.0146, -3.1027, "taunton"),
  eng("Somerset", "bath", "Bath", 51.3811, -2.3590, "bath"),
  eng("Staffordshire", "stoke", "Stoke-on-Trent", 53.0027, -2.1794, "stoke-on-trent"),
  eng("Suffolk", "ipswich", "Ipswich", 52.0567, 1.1482, "ipswich"),
  eng("Surrey", "guildford", "Guildford", 51.2362, -0.5704, "guildford"),
  eng("Warwickshire", "warwick", "Warwick", 52.2823, -1.5849, "warwick"),
  eng("West Sussex", "crawley", "Crawley", 51.1091, -0.1872, "crawley"),
  eng("West Sussex", "chichester", "Chichester", 50.8365, -0.7792, "chichester"),
  eng("Wiltshire", "swindon", "Swindon", 51.5558, -1.7797, "swindon"),
  eng("Wiltshire", "salisbury", "Salisbury", 51.0688, -1.7945, "salisbury"),
  eng("Worcestershire", "worcester", "Worcester", 52.1936, -2.2216, "worcester"),
  eng("Bedfordshire", "bedford", "Bedford", 52.1350, -0.4670, "bedford"),
  eng("Bedfordshire", "dunstable", "Dunstable", 51.8860, -0.5210, "dunstable"),
  eng("Bedfordshire", "biggleswade", "Biggleswade", 52.0870, -0.2640, "biggleswade"),
  eng("Bedfordshire", "leighton-buzzard", "Leighton Buzzard", 51.9160, -0.6620, "leighton-buzzard"),
  eng("Berkshire", "slough", "Slough", 51.5105, -0.5950, "slough"),
  eng("Berkshire", "windsor", "Windsor", 51.4791, -0.6095, "windsor"),
  eng("Berkshire", "bracknell", "Bracknell", 51.4160, -0.7540, "bracknell"),
  eng("Berkshire", "newbury", "Newbury", 51.4014, -1.3230, "newbury"),
  eng("Berkshire", "maidenhead", "Maidenhead", 51.5218, -0.7218, "maidenhead"),
  eng("Berkshire", "wokingham", "Wokingham", 51.4110, -0.8340, "wokingham"),
  eng("Buckinghamshire", "aylesbury", "Aylesbury", 51.8156, -0.8084, "aylesbury"),
  eng("Buckinghamshire", "high-wycombe", "High Wycombe", 51.6287, -0.7482, "high-wycombe"),
  eng("Buckinghamshire", "amersham", "Amersham", 51.6740, -0.6070, "amersham"),
  eng("Buckinghamshire", "marlow", "Marlow", 51.5710, -0.7770, "marlow"),
  eng("Buckinghamshire", "chesham", "Chesham", 51.7060, -0.6120, "chesham"),
  eng("Cambridgeshire", "peterborough", "Peterborough", 52.5695, -0.2405, "peterborough"),
  eng("Cambridgeshire", "ely", "Ely", 52.3990, 0.2620, "ely"),
  eng("Cambridgeshire", "huntingdon", "Huntingdon", 52.3310, -0.1830, "huntingdon"),
  eng("Cambridgeshire", "st-neots", "St Neots", 52.2280, -0.2700, "st-neots"),
  eng("Cambridgeshire", "wisbech", "Wisbech", 52.6640, 0.1600, "wisbech"),
  eng("Cambridgeshire", "march", "March", 52.5510, 0.0880, "march"),
  eng("Cheshire", "warrington", "Warrington", 53.3900, -2.5970, "warrington"),
  eng("Cheshire", "crewe", "Crewe", 53.0990, -2.4400, "crewe"),
  eng("Cheshire", "macclesfield", "Macclesfield", 53.2590, -2.1250, "macclesfield"),
  eng("Cheshire", "northwich", "Northwich", 53.2590, -2.5180, "northwich"),
  eng("Cheshire", "ellesmere-port", "Ellesmere Port", 53.2790, -2.8970, "ellesmere-port"),
  eng("Cheshire", "congleton", "Congleton", 53.1620, -2.2160, "congleton"),
  eng("Cheshire", "winsford", "Winsford", 53.1930, -2.5210, "winsford"),
  eng("Cheshire", "wilmslow", "Wilmslow", 53.3270, -2.2310, "wilmslow"),
  eng("Cornwall", "newquay", "Newquay", 50.4150, -5.0730, "newquay"),
  eng("Cornwall", "st-ives", "St Ives", 50.2110, -5.4800, "st-ives"),
  eng("Cornwall", "penzance", "Penzance", 50.1186, -5.5370, "penzance"),
  eng("Cornwall", "falmouth", "Falmouth", 50.1530, -5.0710, "falmouth"),
  eng("Cornwall", "camborne", "Camborne", 50.2130, -5.2980, "camborne"),
  eng("Cornwall", "redruth", "Redruth", 50.2330, -5.2270, "redruth"),
  eng("Cornwall", "bodmin", "Bodmin", 50.4710, -4.7220, "bodmin"),
  eng("Cornwall", "st-austell", "St Austell", 50.3390, -4.7900, "st-austell"),
  eng("Cornwall", "bude", "Bude", 50.8270, -4.5450, "bude"),
  eng("Cornwall", "looe", "Looe", 50.3540, -4.4540, "looe"),
  eng("Cumbria", "kendal", "Kendal", 54.3280, -2.7450, "kendal"),
  eng("Cumbria", "barrow-in-furness", "Barrow-in-Furness", 54.1110, -3.2280, "barrow-in-furness"),
  eng("Cumbria", "whitehaven", "Whitehaven", 54.5490, -3.5870, "whitehaven"),
  eng("Cumbria", "workington", "Workington", 54.6430, -3.5440, "workington"),
  eng("Cumbria", "penrith", "Penrith", 54.6650, -2.7530, "penrith"),
  eng("Cumbria", "windermere", "Windermere", 54.3800, -2.9060, "windermere"),
  eng("Cumbria", "keswick", "Keswick", 54.6010, -3.1370, "keswick"),
  eng("Cumbria", "ulverston", "Ulverston", 54.1960, -3.0950, "ulverston"),
  eng("Derbyshire", "chesterfield", "Chesterfield", 53.2350, -1.4210, "chesterfield"),
  eng("Derbyshire", "buxton", "Buxton", 53.2590, -1.9110, "buxton"),
  eng("Derbyshire", "matlock", "Matlock", 53.1390, -1.5560, "matlock"),
  eng("Derbyshire", "glossop", "Glossop", 53.4440, -1.9490, "glossop"),
  eng("Derbyshire", "ilkeston", "Ilkeston", 52.9710, -1.3080, "ilkeston"),
  eng("Derbyshire", "swadlincote", "Swadlincote", 52.7740, -1.5570, "swadlincote"),
  eng("Devon", "torquay", "Torquay", 50.4619, -3.5253, "torquay"),
  eng("Devon", "paignton", "Paignton", 50.4350, -3.5630, "paignton"),
  eng("Devon", "barnstaple", "Barnstaple", 51.0800, -4.0580, "barnstaple"),
  eng("Devon", "exmouth", "Exmouth", 50.6200, -3.4130, "exmouth"),
  eng("Devon", "newton-abbot", "Newton Abbot", 50.5290, -3.6100, "newton-abbot"),
  eng("Devon", "tiverton", "Tiverton", 50.9030, -3.4890, "tiverton"),
  eng("Devon", "bideford", "Bideford", 51.0180, -4.2090, "bideford"),
  eng("Devon", "totnes", "Totnes", 50.4320, -3.6870, "totnes"),
  eng("Devon", "dartmouth", "Dartmouth", 50.3520, -3.5790, "dartmouth"),
  eng("Devon", "ilfracombe", "Ilfracombe", 51.2070, -4.1200, "ilfracombe"),
  eng("Dorset", "poole", "Poole", 50.7150, -1.9870, "poole"),
  eng("Dorset", "weymouth", "Weymouth", 50.6140, -2.4570, "weymouth"),
  eng("Dorset", "dorchester", "Dorchester", 50.7150, -2.4370, "dorchester"),
  eng("Dorset", "bridport", "Bridport", 50.7340, -2.7580, "bridport"),
  eng("Dorset", "sherborne", "Sherborne", 50.9470, -2.5170, "sherborne"),
  eng("Dorset", "christchurch", "Christchurch", 50.7350, -1.7800, "christchurch"),
  eng("Dorset", "blandford-forum", "Blandford Forum", 50.8570, -2.1640, "blandford-forum"),
  eng("County Durham", "darlington", "Darlington", 54.5250, -1.5530, "darlington"),
  eng("County Durham", "hartlepool", "Hartlepool", 54.6890, -1.2120, "hartlepool"),
  eng("County Durham", "stockton-on-tees", "Stockton-on-Tees", 54.5700, -1.3190, "stockton-on-tees"),
  eng("County Durham", "bishop-auckland", "Bishop Auckland", 54.6630, -1.6760, "bishop-auckland"),
  eng("County Durham", "consett", "Consett", 54.8530, -1.8320, "consett"),
  eng("County Durham", "chester-le-street", "Chester-le-Street", 54.8580, -1.5720, "chester-le-street"),
  eng("East Riding of Yorkshire", "beverley", "Beverley", 53.8420, -0.4290, "beverley"),
  eng("East Riding of Yorkshire", "bridlington", "Bridlington", 54.0830, -0.1900, "bridlington"),
  eng("East Riding of Yorkshire", "goole", "Goole", 53.7050, -0.8730, "goole"),
  eng("East Riding of Yorkshire", "driffield", "Driffield", 54.0060, -0.4400, "driffield"),
  eng("East Sussex", "hastings", "Hastings", 50.8550, 0.5730, "hastings"),
  eng("East Sussex", "eastbourne", "Eastbourne", 50.7680, 0.2900, "eastbourne"),
  eng("East Sussex", "lewes", "Lewes", 50.8740, 0.0090, "lewes"),
  eng("East Sussex", "bexhill", "Bexhill-on-Sea", 50.8420, 0.4700, "bexhill-on-sea"),
  eng("East Sussex", "rye", "Rye", 50.9500, 0.7330, "rye"),
  eng("East Sussex", "seaford", "Seaford", 50.7710, 0.1020, "seaford"),
  eng("East Sussex", "crowborough", "Crowborough", 51.0600, 0.1620, "crowborough"),
  eng("Essex", "colchester", "Colchester", 51.8890, 0.9030, "colchester"),
  eng("Essex", "basildon", "Basildon", 51.5760, 0.4880, "basildon"),
  eng("Essex", "harlow", "Harlow", 51.7720, 0.1020, "harlow"),
  eng("Essex", "braintree", "Braintree", 51.8780, 0.5500, "braintree"),
  eng("Essex", "clacton-on-sea", "Clacton-on-Sea", 51.7900, 1.1530, "clacton-on-sea"),
  eng("Essex", "brentwood", "Brentwood", 51.6210, 0.3050, "brentwood"),
  eng("Essex", "grays", "Grays", 51.4760, 0.3230, "grays"),
  eng("Essex", "maldon", "Maldon", 51.7320, 0.6750, "maldon"),
  eng("Essex", "saffron-walden", "Saffron Walden", 52.0230, 0.2430, "saffron-walden"),
  eng("Essex", "witham", "Witham", 51.8000, 0.6380, "witham"),
  eng("Gloucestershire", "stroud", "Stroud", 51.7450, -2.2170, "stroud"),
  eng("Gloucestershire", "cirencester", "Cirencester", 51.7180, -1.9680, "cirencester"),
  eng("Gloucestershire", "tewkesbury", "Tewkesbury", 51.9920, -2.1590, "tewkesbury"),
  eng("Greater Manchester", "salford", "Salford", 53.4830, -2.2930, "salford"),
  eng("Greater Manchester", "bolton", "Bolton", 53.5780, -2.4290, "bolton"),
  eng("Greater Manchester", "stockport", "Stockport", 53.4080, -2.1490, "stockport"),
  eng("Greater Manchester", "oldham", "Oldham", 53.5410, -2.1180, "oldham"),
  eng("Greater Manchester", "rochdale", "Rochdale", 53.6100, -2.1560, "rochdale"),
  eng("Greater Manchester", "wigan", "Wigan", 53.5450, -2.6320, "wigan"),
  eng("Greater Manchester", "bury", "Bury", 53.5930, -2.2960, "bury"),
  eng("Greater Manchester", "ashton-under-lyne", "Ashton-under-Lyne", 53.4890, -2.0980, "ashton-under-lyne"),
  eng("Greater Manchester", "altrincham", "Altrincham", 53.3870, -2.3480, "altrincham"),
  eng("Greater Manchester", "sale", "Sale", 53.4240, -2.3230, "sale"),
  eng("Greater Manchester", "middleton", "Middleton", 53.5540, -2.1930, "middleton"),
  eng("Greater Manchester", "leigh", "Leigh", 53.4970, -2.5150, "leigh"),
  eng("Hampshire", "winchester", "Winchester", 51.0630, -1.3080, "winchester"),
  eng("Hampshire", "basingstoke", "Basingstoke", 51.2660, -1.0870, "basingstoke"),
  eng("Hampshire", "aldershot", "Aldershot", 51.2480, -0.7640, "aldershot"),
  eng("Hampshire", "farnborough", "Farnborough", 51.2930, -0.7530, "farnborough"),
  eng("Hampshire", "andover", "Andover", 51.2080, -1.4800, "andover"),
  eng("Hampshire", "eastleigh", "Eastleigh", 50.9690, -1.3500, "eastleigh"),
  eng("Hampshire", "fareham", "Fareham", 50.8520, -1.1790, "fareham"),
  eng("Hampshire", "gosport", "Gosport", 50.7950, -1.1280, "gosport"),
  eng("Hampshire", "havant", "Havant", 50.8510, -0.9830, "havant"),
  eng("Hampshire", "petersfield", "Petersfield", 51.0040, -0.9370, "petersfield"),
  eng("Hampshire", "romsey", "Romsey", 50.9890, -1.4970, "romsey"),
  eng("Hampshire", "lymington", "Lymington", 50.7590, -1.5430, "lymington"),
  eng("Herefordshire", "leominster", "Leominster", 52.2270, -2.7390, "leominster"),
  eng("Herefordshire", "ross-on-wye", "Ross-on-Wye", 51.9140, -2.5810, "ross-on-wye"),
  eng("Hertfordshire", "stevenage", "Stevenage", 51.9020, -0.2020, "stevenage"),
  eng("Hertfordshire", "hemel-hempstead", "Hemel Hempstead", 51.7530, -0.4490, "hemel-hempstead"),
  eng("Hertfordshire", "welwyn-garden-city", "Welwyn Garden City", 51.8020, -0.2050, "welwyn-garden-city"),
  eng("Hertfordshire", "hitchin", "Hitchin", 51.9490, -0.2790, "hitchin"),
  eng("Hertfordshire", "hertford", "Hertford", 51.7960, -0.0780, "hertford"),
  eng("Hertfordshire", "bishops-stortford", "Bishop's Stortford", 51.8720, 0.1590, "bishops-stortford"),
  eng("Hertfordshire", "letchworth", "Letchworth Garden City", 51.9780, -0.2280, "letchworth-garden-city"),
  eng("Hertfordshire", "borehamwood", "Borehamwood", 51.6570, -0.2720, "borehamwood"),
  eng("Hertfordshire", "rickmansworth", "Rickmansworth", 51.6390, -0.4700, "rickmansworth"),
  eng("Hertfordshire", "berkhamsted", "Berkhamsted", 51.7600, -0.5650, "berkhamsted"),
  eng("Hertfordshire", "cheshunt", "Cheshunt", 51.7020, -0.0350, "cheshunt"),
  eng("Isle of Wight", "ryde", "Ryde", 50.7280, -1.1600, "ryde"),
  eng("Isle of Wight", "cowes", "Cowes", 50.7620, -1.2980, "cowes"),
  eng("Isle of Wight", "sandown", "Sandown", 50.6540, -1.1560, "sandown"),
  eng("Isle of Wight", "shanklin", "Shanklin", 50.6320, -1.1780, "shanklin"),
  eng("Isle of Wight", "ventnor", "Ventnor", 50.5950, -1.2050, "ventnor"),
  eng("Kent", "dover", "Dover", 51.1279, 1.3134, "dover"),
  eng("Kent", "margate", "Margate", 51.3890, 1.3860, "margate"),
  eng("Kent", "ramsgate", "Ramsgate", 51.3360, 1.4160, "ramsgate"),
  eng("Kent", "broadstairs", "Broadstairs", 51.3600, 1.4330, "broadstairs"),
  eng("Kent", "folkestone", "Folkestone", 51.0810, 1.1660, "folkestone"),
  eng("Kent", "ashford", "Ashford", 51.1470, 0.8750, "ashford"),
  eng("Kent", "tunbridge-wells", "Royal Tunbridge Wells", 51.1320, 0.2630, "tunbridge-wells"),
  eng("Kent", "tonbridge", "Tonbridge", 51.1980, 0.2760, "tonbridge"),
  eng("Kent", "gravesend", "Gravesend", 51.4420, 0.3700, "gravesend"),
  eng("Kent", "dartford", "Dartford", 51.4460, 0.2190, "dartford"),
  eng("Kent", "chatham", "Chatham", 51.3790, 0.5220, "chatham"),
  eng("Kent", "gillingham", "Gillingham", 51.3850, 0.5500, "gillingham"),
  eng("Kent", "rochester", "Rochester", 51.3880, 0.5040, "rochester"),
  eng("Kent", "sittingbourne", "Sittingbourne", 51.3400, 0.7370, "sittingbourne"),
  eng("Kent", "whitstable", "Whitstable", 51.3600, 1.0260, "whitstable"),
  eng("Kent", "herne-bay", "Herne Bay", 51.3720, 1.1290, "herne-bay"),
  eng("Kent", "deal", "Deal", 51.2230, 1.4010, "deal"),
  eng("Kent", "faversham", "Faversham", 51.3160, 0.8900, "faversham"),
  eng("Kent", "sevenoaks", "Sevenoaks", 51.2720, 0.1900, "sevenoaks"),
  eng("Kent", "sheerness", "Sheerness", 51.4410, 0.7620, "sheerness"),
  eng("Lancashire", "blackburn", "Blackburn", 53.7480, -2.4820, "blackburn"),
  eng("Lancashire", "burnley", "Burnley", 53.7890, -2.2480, "burnley"),
  eng("Lancashire", "lancaster", "Lancaster", 54.0470, -2.8010, "lancaster"),
  eng("Lancashire", "chorley", "Chorley", 53.6530, -2.6320, "chorley"),
  eng("Lancashire", "morecambe", "Morecambe", 54.0700, -2.8660, "morecambe"),
  eng("Lancashire", "accrington", "Accrington", 53.7530, -2.3640, "accrington"),
  eng("Lancashire", "nelson", "Nelson", 53.8360, -2.2180, "nelson"),
  eng("Lancashire", "skelmersdale", "Skelmersdale", 53.5500, -2.7760, "skelmersdale"),
  eng("Lancashire", "ormskirk", "Ormskirk", 53.5680, -2.8830, "ormskirk"),
  eng("Lancashire", "lytham-st-annes", "Lytham St Annes", 53.7440, -2.9970, "lytham-st-annes"),
  eng("Lancashire", "clitheroe", "Clitheroe", 53.8710, -2.3920, "clitheroe"),
  eng("Lancashire", "leyland", "Leyland", 53.6920, -2.6960, "leyland"),
  eng("Leicestershire", "loughborough", "Loughborough", 52.7720, -1.2060, "loughborough"),
  eng("Leicestershire", "hinckley", "Hinckley", 52.5410, -1.3730, "hinckley"),
  eng("Leicestershire", "melton-mowbray", "Melton Mowbray", 52.7660, -0.8860, "melton-mowbray"),
  eng("Leicestershire", "coalville", "Coalville", 52.7230, -1.3700, "coalville"),
  eng("Leicestershire", "market-harborough", "Market Harborough", 52.4790, -0.9210, "market-harborough"),
  eng("Lincolnshire", "grimsby", "Grimsby", 53.5670, -0.0800, "grimsby"),
  eng("Lincolnshire", "scunthorpe", "Scunthorpe", 53.5900, -0.6540, "scunthorpe"),
  eng("Lincolnshire", "boston", "Boston", 52.9790, -0.0260, "boston"),
  eng("Lincolnshire", "grantham", "Grantham", 52.9120, -0.6420, "grantham"),
  eng("Lincolnshire", "skegness", "Skegness", 53.1430, 0.3380, "skegness"),
  eng("Lincolnshire", "stamford", "Stamford", 52.6510, -0.4830, "stamford"),
  eng("Lincolnshire", "spalding", "Spalding", 52.7870, -0.1520, "spalding"),
  eng("Lincolnshire", "louth", "Louth", 53.3670, -0.0050, "louth"),
  eng("Lincolnshire", "gainsborough", "Gainsborough", 53.4000, -0.7740, "gainsborough"),
  eng("Merseyside", "birkenhead", "Birkenhead", 53.3930, -3.0140, "birkenhead"),
  eng("Merseyside", "st-helens", "St Helens", 53.4540, -2.7360, "st-helens"),
  eng("Merseyside", "southport", "Southport", 53.6480, -3.0100, "southport"),
  eng("Merseyside", "bootle", "Bootle", 53.4460, -2.9890, "bootle"),
  eng("Merseyside", "wallasey", "Wallasey", 53.4230, -3.0680, "wallasey"),
  eng("Merseyside", "prescot", "Prescot", 53.4280, -2.8060, "prescot"),
  eng("Merseyside", "formby", "Formby", 53.5580, -3.0670, "formby"),
  eng("Norfolk", "great-yarmouth", "Great Yarmouth", 52.6080, 1.7300, "great-yarmouth"),
  eng("Norfolk", "kings-lynn", "King's Lynn", 52.7520, 0.3960, "kings-lynn"),
  eng("Norfolk", "cromer", "Cromer", 52.9310, 1.3010, "cromer"),
  eng("Norfolk", "thetford", "Thetford", 52.4130, 0.7480, "thetford"),
  eng("Norfolk", "dereham", "Dereham", 52.6810, 0.9400, "dereham"),
  eng("Norfolk", "wymondham", "Wymondham", 52.5710, 1.1160, "wymondham"),
  eng("North Yorkshire", "scarborough", "Scarborough", 54.2830, -0.3990, "scarborough"),
  eng("North Yorkshire", "middlesbrough", "Middlesbrough", 54.5740, -1.2350, "middlesbrough"),
  eng("North Yorkshire", "whitby", "Whitby", 54.4860, -0.6130, "whitby"),
  eng("North Yorkshire", "ripon", "Ripon", 54.1380, -1.5210, "ripon"),
  eng("North Yorkshire", "skipton", "Skipton", 53.9610, -2.0160, "skipton"),
  eng("North Yorkshire", "northallerton", "Northallerton", 54.3390, -1.4340, "northallerton"),
  eng("North Yorkshire", "selby", "Selby", 53.7830, -1.0670, "selby"),
  eng("North Yorkshire", "knaresborough", "Knaresborough", 54.0080, -1.4670, "knaresborough"),
  eng("North Yorkshire", "redcar", "Redcar", 54.6180, -1.0700, "redcar"),
  eng("North Yorkshire", "thirsk", "Thirsk", 54.2330, -1.3410, "thirsk"),
  eng("North Yorkshire", "richmond-yorks", "Richmond, North Yorkshire", 54.4030, -1.7370, "richmond"),
  eng("Northamptonshire", "kettering", "Kettering", 52.3980, -0.7230, "kettering"),
  eng("Northamptonshire", "corby", "Corby", 52.4890, -0.7020, "corby"),
  eng("Northamptonshire", "wellingborough", "Wellingborough", 52.3020, -0.6960, "wellingborough"),
  eng("Northamptonshire", "rushden", "Rushden", 52.2890, -0.6000, "rushden"),
  eng("Northamptonshire", "daventry", "Daventry", 52.2580, -1.1620, "daventry"),
  eng("Northumberland", "alnwick", "Alnwick", 55.4130, -1.7060, "alnwick"),
  eng("Northumberland", "hexham", "Hexham", 54.9710, -2.1010, "hexham"),
  eng("Northumberland", "berwick-upon-tweed", "Berwick-upon-Tweed", 55.7710, -2.0050, "berwick-upon-tweed"),
  eng("Northumberland", "ashington", "Ashington", 55.1810, -1.5660, "ashington"),
  eng("Northumberland", "blyth", "Blyth", 55.1270, -1.5100, "blyth"),
  eng("Northumberland", "cramlington", "Cramlington", 55.0870, -1.5860, "cramlington"),
  eng("Nottinghamshire", "mansfield", "Mansfield", 53.1440, -1.1980, "mansfield"),
  eng("Nottinghamshire", "newark-on-trent", "Newark-on-Trent", 53.0770, -0.8120, "newark-on-trent"),
  eng("Nottinghamshire", "worksop", "Worksop", 53.3050, -1.1240, "worksop"),
  eng("Nottinghamshire", "retford", "Retford", 53.3230, -0.9440, "retford"),
  eng("Nottinghamshire", "sutton-in-ashfield", "Sutton-in-Ashfield", 53.1230, -1.2600, "sutton-in-ashfield"),
  eng("Nottinghamshire", "beeston", "Beeston", 52.9260, -1.2140, "beeston"),
  eng("Oxfordshire", "banbury", "Banbury", 52.0630, -1.3400, "banbury"),
  eng("Oxfordshire", "bicester", "Bicester", 51.9000, -1.1520, "bicester"),
  eng("Oxfordshire", "abingdon", "Abingdon-on-Thames", 51.6710, -1.2830, "abingdon-on-thames"),
  eng("Oxfordshire", "witney", "Witney", 51.7860, -1.4850, "witney"),
  eng("Oxfordshire", "didcot", "Didcot", 51.6060, -1.2410, "didcot"),
  eng("Oxfordshire", "henley-on-thames", "Henley-on-Thames", 51.5360, -0.9030, "henley-on-thames"),
  eng("Shropshire", "oswestry", "Oswestry", 52.8600, -3.0540, "oswestry"),
  eng("Shropshire", "bridgnorth", "Bridgnorth", 52.5350, -2.4180, "bridgnorth"),
  eng("Shropshire", "ludlow", "Ludlow", 52.3680, -2.7180, "ludlow"),
  eng("Shropshire", "whitchurch", "Whitchurch", 52.9690, -2.6820, "whitchurch"),
  eng("Somerset", "yeovil", "Yeovil", 50.9420, -2.6330, "yeovil"),
  eng("Somerset", "bridgwater", "Bridgwater", 51.1280, -2.9950, "bridgwater"),
  eng("Somerset", "weston-super-mare", "Weston-super-Mare", 51.3460, -2.9770, "weston-super-mare"),
  eng("Somerset", "wells", "Wells", 51.2090, -2.6470, "wells"),
  eng("Somerset", "frome", "Frome", 51.2280, -2.3200, "frome"),
  eng("Somerset", "glastonbury", "Glastonbury", 51.1490, -2.7140, "glastonbury"),
  eng("Somerset", "street", "Street", 51.1250, -2.7390, "street"),
  eng("Somerset", "minehead", "Minehead", 51.2050, -3.4780, "minehead"),
  eng("Somerset", "burnham-on-sea", "Burnham-on-Sea", 51.2380, -2.9970, "burnham-on-sea"),
  eng("Somerset", "clevedon", "Clevedon", 51.4380, -2.8560, "clevedon"),
  eng("South Yorkshire", "rotherham", "Rotherham", 53.4300, -1.3570, "rotherham"),
  eng("South Yorkshire", "barnsley", "Barnsley", 53.5530, -1.4790, "barnsley"),
  eng("Staffordshire", "stafford", "Stafford", 52.8060, -2.1170, "stafford"),
  eng("Staffordshire", "burton-upon-trent", "Burton upon Trent", 52.8060, -1.6420, "burton-upon-trent"),
  eng("Staffordshire", "lichfield", "Lichfield", 52.6820, -1.8290, "lichfield"),
  eng("Staffordshire", "newcastle-under-lyme", "Newcastle-under-Lyme", 53.0100, -2.2270, "newcastle-under-lyme"),
  eng("Staffordshire", "tamworth", "Tamworth", 52.6330, -1.6910, "tamworth"),
  eng("Staffordshire", "cannock", "Cannock", 52.6910, -2.0300, "cannock"),
  eng("Staffordshire", "leek", "Leek", 53.1080, -2.0230, "leek"),
  eng("Staffordshire", "rugeley", "Rugeley", 52.7600, -1.9380, "rugeley"),
  eng("Suffolk", "bury-st-edmunds", "Bury St Edmunds", 52.2470, 0.7110, "bury-st-edmunds"),
  eng("Suffolk", "lowestoft", "Lowestoft", 52.4750, 1.7520, "lowestoft"),
  eng("Suffolk", "felixstowe", "Felixstowe", 51.9640, 1.3510, "felixstowe"),
  eng("Suffolk", "newmarket", "Newmarket", 52.2450, 0.4060, "newmarket"),
  eng("Suffolk", "sudbury", "Sudbury", 52.0390, 0.7300, "sudbury"),
  eng("Suffolk", "woodbridge", "Woodbridge", 52.0940, 1.3170, "woodbridge"),
  eng("Suffolk", "aldeburgh", "Aldeburgh", 52.1530, 1.6010, "aldeburgh"),
  eng("Suffolk", "haverhill", "Haverhill", 52.0810, 0.4390, "haverhill"),
  eng("Suffolk", "stowmarket", "Stowmarket", 52.1890, 0.9970, "stowmarket"),
  eng("Surrey", "woking", "Woking", 51.3190, -0.5580, "woking"),
  eng("Surrey", "epsom", "Epsom", 51.3360, -0.2680, "epsom"),
  eng("Surrey", "camberley", "Camberley", 51.3350, -0.7420, "camberley"),
  eng("Surrey", "redhill", "Redhill", 51.2400, -0.1700, "redhill"),
  eng("Surrey", "farnham", "Farnham", 51.2150, -0.7990, "farnham"),
  eng("Surrey", "staines", "Staines-upon-Thames", 51.4340, -0.5110, "staines-upon-thames"),
  eng("Surrey", "esher", "Esher", 51.3690, -0.3660, "esher"),
  eng("Surrey", "dorking", "Dorking", 51.2330, -0.3300, "dorking"),
  eng("Surrey", "reigate", "Reigate", 51.2370, -0.2060, "reigate"),
  eng("Surrey", "leatherhead", "Leatherhead", 51.2960, -0.3300, "leatherhead"),
  eng("Surrey", "weybridge", "Weybridge", 51.3720, -0.4580, "weybridge"),
  eng("Surrey", "godalming", "Godalming", 51.1850, -0.6130, "godalming"),
  eng("Tyne and Wear", "gateshead", "Gateshead", 54.9530, -1.6030, "gateshead"),
  eng("Tyne and Wear", "south-shields", "South Shields", 54.9990, -1.4320, "south-shields"),
  eng("Tyne and Wear", "washington", "Washington", 54.9000, -1.5200, "washington"),
  eng("Tyne and Wear", "whitley-bay", "Whitley Bay", 55.0430, -1.4470, "whitley-bay"),
  eng("Tyne and Wear", "tynemouth", "Tynemouth", 55.0170, -1.4230, "tynemouth"),
  eng("Tyne and Wear", "jarrow", "Jarrow", 54.9800, -1.4900, "jarrow"),
  eng("Warwickshire", "stratford-upon-avon", "Stratford-upon-Avon", 52.1920, -1.7070, "stratford-upon-avon"),
  eng("Warwickshire", "nuneaton", "Nuneaton", 52.5230, -1.4680, "nuneaton"),
  eng("Warwickshire", "rugby", "Rugby", 52.3700, -1.2650, "rugby"),
  eng("Warwickshire", "leamington-spa", "Royal Leamington Spa", 52.2920, -1.5370, "leamington-spa"),
  eng("Warwickshire", "kenilworth", "Kenilworth", 52.3410, -1.5860, "kenilworth"),
  eng("Warwickshire", "bedworth", "Bedworth", 52.4790, -1.4720, "bedworth"),
  eng("West Midlands", "dudley", "Dudley", 52.5120, -2.0810, "dudley"),
  eng("West Midlands", "walsall", "Walsall", 52.5860, -1.9820, "walsall"),
  eng("West Midlands", "west-bromwich", "West Bromwich", 52.5190, -1.9950, "west-bromwich"),
  eng("West Midlands", "solihull", "Solihull", 52.4120, -1.7780, "solihull"),
  eng("West Midlands", "sutton-coldfield", "Sutton Coldfield", 52.5630, -1.8220, "sutton-coldfield"),
  eng("West Midlands", "smethwick", "Smethwick", 52.4930, -1.9680, "smethwick"),
  eng("West Midlands", "halesowen", "Halesowen", 52.4490, -2.0500, "halesowen"),
  eng("West Midlands", "stourbridge", "Stourbridge", 52.4570, -2.1450, "stourbridge"),
  eng("West Sussex", "worthing", "Worthing", 50.8130, -0.3720, "worthing"),
  eng("West Sussex", "horsham", "Horsham", 51.0620, -0.3260, "horsham"),
  eng("West Sussex", "bognor-regis", "Bognor Regis", 50.7830, -0.6730, "bognor-regis"),
  eng("West Sussex", "littlehampton", "Littlehampton", 50.8100, -0.5410, "littlehampton"),
  eng("West Sussex", "burgess-hill", "Burgess Hill", 50.9560, -0.1330, "burgess-hill"),
  eng("West Sussex", "haywards-heath", "Haywards Heath", 51.0050, -0.1030, "haywards-heath"),
  eng("West Sussex", "shoreham-by-sea", "Shoreham-by-Sea", 50.8330, -0.2740, "shoreham-by-sea"),
  eng("West Sussex", "east-grinstead", "East Grinstead", 51.1260, -0.0100, "east-grinstead"),
  eng("West Yorkshire", "wakefield", "Wakefield", 53.6830, -1.4990, "wakefield"),
  eng("West Yorkshire", "halifax", "Halifax", 53.7220, -1.8590, "halifax"),
  eng("West Yorkshire", "keighley", "Keighley", 53.8680, -1.9080, "keighley"),
  eng("West Yorkshire", "dewsbury", "Dewsbury", 53.6900, -1.6300, "dewsbury"),
  eng("West Yorkshire", "batley", "Batley", 53.7160, -1.6350, "batley"),
  eng("West Yorkshire", "pontefract", "Pontefract", 53.6910, -1.3110, "pontefract"),
  eng("West Yorkshire", "castleford", "Castleford", 53.7250, -1.3500, "castleford"),
  eng("West Yorkshire", "ilkley", "Ilkley", 53.9250, -1.8220, "ilkley"),
  eng("West Yorkshire", "otley", "Otley", 53.9050, -1.6900, "otley"),
  eng("Wiltshire", "chippenham", "Chippenham", 51.4580, -2.1160, "chippenham"),
  eng("Wiltshire", "trowbridge", "Trowbridge", 51.3200, -2.2090, "trowbridge"),
  eng("Wiltshire", "devizes", "Devizes", 51.3520, -1.9950, "devizes"),
  eng("Wiltshire", "marlborough", "Marlborough", 51.4210, -1.7280, "marlborough"),
  eng("Wiltshire", "warminster", "Warminster", 51.2050, -2.1810, "warminster"),
  eng("Wiltshire", "melksham", "Melksham", 51.3740, -2.1400, "melksham"),
  eng("Worcestershire", "kidderminster", "Kidderminster", 52.3880, -2.2490, "kidderminster"),
  eng("Worcestershire", "redditch", "Redditch", 52.3060, -1.9440, "redditch"),
  eng("Worcestershire", "bromsgrove", "Bromsgrove", 52.3350, -2.0590, "bromsgrove"),
  eng("Worcestershire", "malvern", "Malvern", 52.1110, -2.3260, "malvern"),
  eng("Worcestershire", "evesham", "Evesham", 52.0920, -1.9470, "evesham"),
  eng("Worcestershire", "droitwich", "Droitwich Spa", 52.2670, -2.1520, "droitwich-spa"),

  // ---- Wales --------------------------------------------------------------
  wal("Cardiff", "cardiff", "Cardiff", 51.4816, -3.1791, "cardiff"),
  wal("Swansea", "swansea", "Swansea", 51.6214, -3.9436, "swansea"),
  wal("Newport", "newport", "Newport", 51.5842, -2.9977, "newport"),
  wal("Blaenau Gwent", "ebbw-vale", "Ebbw Vale", 51.7770, -3.2050, "ebbw-vale"),
  wal("Bridgend", "bridgend", "Bridgend", 51.5040, -3.5760, "bridgend"),
  wal("Caerphilly", "caerphilly", "Caerphilly", 51.5786, -3.2180, "caerphilly"),
  wal("Carmarthenshire", "carmarthen", "Carmarthen", 51.8558, -4.3090, "carmarthen"),
  wal("Ceredigion", "aberystwyth", "Aberystwyth", 52.4153, -4.0829, "aberystwyth"),
  wal("Conwy", "llandudno", "Llandudno", 53.3241, -3.8276, "llandudno"),
  wal("Denbighshire", "rhyl", "Rhyl", 53.3210, -3.4890, "rhyl"),
  wal("Denbighshire", "st-asaph", "St Asaph", 53.2583, -3.4417, "st-asaph"),
  wal("Flintshire", "mold", "Mold", 53.1667, -3.1400, "mold"),
  wal("Gwynedd", "bangor", "Bangor", 53.2280, -4.1280, "bangor"),
  wal("Isle of Anglesey", "holyhead", "Holyhead", 53.3090, -4.6330, "holyhead"),
  wal("Merthyr Tydfil", "merthyr-tydfil", "Merthyr Tydfil", 51.7480, -3.3780, "merthyr-tydfil"),
  wal("Monmouthshire", "abergavenny", "Abergavenny", 51.8240, -3.0170, "abergavenny"),
  wal("Neath Port Talbot", "neath", "Neath", 51.6640, -3.8060, "neath"),
  wal("Pembrokeshire", "haverfordwest", "Haverfordwest", 51.8010, -4.9700, "haverfordwest"),
  wal("Pembrokeshire", "st-davids", "St Davids", 51.8819, -5.2683, "st-davids"),
  wal("Powys", "brecon", "Brecon", 51.9470, -3.3900, "brecon"),
  wal("Rhondda Cynon Taf", "pontypridd", "Pontypridd", 51.6020, -3.3420, "pontypridd"),
  wal("Torfaen", "cwmbran", "Cwmbran", 51.6530, -3.0210, "cwmbran"),
  wal("Vale of Glamorgan", "barry", "Barry", 51.4050, -3.2830, "barry"),
  wal("Wrexham", "wrexham", "Wrexham", 53.0430, -2.9925, "wrexham"),

  // ---- Scotland -----------------------------------------------------------
  sco("Glasgow City", "glasgow", "Glasgow", 55.8642, -4.2518, "glasgow"),
  sco("City of Edinburgh", "edinburgh", "Edinburgh", 55.9533, -3.1883, "edinburgh"),
  sco("Aberdeen City", "aberdeen", "Aberdeen", 57.1497, -2.0943, "aberdeen"),
  sco("Dundee City", "dundee", "Dundee", 56.4620, -2.9707, "dundee"),
  sco("Highland", "inverness", "Inverness", 57.4778, -4.2247, "inverness"),
  sco("Aberdeenshire", "peterhead", "Peterhead", 57.5090, -1.7830, "peterhead"),
  sco("Angus", "arbroath", "Arbroath", 56.5610, -2.5860, "arbroath"),
  sco("Argyll and Bute", "oban", "Oban", 56.4150, -5.4720, "oban"),
  sco("Clackmannanshire", "alloa", "Alloa", 56.1160, -3.7900, "alloa"),
  sco("Dumfries and Galloway", "dumfries", "Dumfries", 55.0700, -3.6030, "dumfries"),
  sco("East Ayrshire", "kilmarnock", "Kilmarnock", 55.6110, -4.4980, "kilmarnock"),
  sco("East Dunbartonshire", "kirkintilloch", "Kirkintilloch", 55.9390, -4.1550, "kirkintilloch"),
  sco("East Lothian", "haddington", "Haddington", 55.9550, -2.7740, "haddington"),
  sco("East Renfrewshire", "barrhead", "Barrhead", 55.7980, -4.3910, "barrhead"),
  sco("Falkirk", "falkirk", "Falkirk", 56.0019, -3.7839, "falkirk"),
  sco("Fife", "dunfermline", "Dunfermline", 56.0720, -3.4520, "dunfermline"),
  sco("Inverclyde", "greenock", "Greenock", 55.9490, -4.7610, "greenock"),
  sco("Midlothian", "dalkeith", "Dalkeith", 55.8950, -3.0660, "dalkeith"),
  sco("Moray", "elgin", "Elgin", 57.6500, -3.3150, "elgin"),
  sco("Na h-Eileanan Siar", "stornoway", "Stornoway", 58.2090, -6.3890, "stornoway"),
  sco("North Ayrshire", "irvine", "Irvine", 55.6110, -4.6700, "irvine"),
  sco("North Lanarkshire", "motherwell", "Motherwell", 55.7890, -3.9910, "motherwell"),
  sco("Orkney Islands", "kirkwall", "Kirkwall", 58.9810, -2.9600, "kirkwall"),
  sco("Perth and Kinross", "perth", "Perth", 56.3950, -3.4308, "perth"),
  sco("Renfrewshire", "paisley", "Paisley", 55.8460, -4.4230, "paisley"),
  sco("Scottish Borders", "galashiels", "Galashiels", 55.6180, -2.8070, "galashiels"),
  sco("Shetland Islands", "lerwick", "Lerwick", 60.1550, -1.1450, "lerwick"),
  sco("South Ayrshire", "ayr", "Ayr", 55.4580, -4.6290, "ayr"),
  sco("South Lanarkshire", "hamilton", "Hamilton", 55.7770, -4.0390, "hamilton"),
  sco("Stirling", "stirling", "Stirling", 56.1165, -3.9369, "stirling"),
  sco("West Dunbartonshire", "dumbarton", "Dumbarton", 55.9440, -4.5670, "dumbarton"),
  sco("West Lothian", "livingston", "Livingston", 55.8830, -3.5230, "livingston"),

  // ---- Northern Ireland ---------------------------------------------------
  nir("Antrim", "belfast", "Belfast", 54.5973, -5.9301, "belfast"),
  nir("Antrim", "lisburn", "Lisburn", 54.5162, -6.0581, "lisburn"),
  nir("Londonderry", "derry", "Derry", 54.9966, -7.3086, "londonderry"),
  nir("Armagh", "armagh", "Armagh", 54.3500, -6.6530, "armagh"),
  nir("Down", "newry", "Newry", 54.1750, -6.3390, "newry"),
  nir("Fermanagh", "enniskillen", "Enniskillen", 54.3440, -7.6320, "enniskillen"),
  nir("Tyrone", "omagh", "Omagh", 54.5970, -7.3100, "omagh"),
];

export const DEFAULT_REGION = CITIES[0]; // London

/// Nearest curated city to a point, plus the distance to it.
export function nearestCity(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d != null && d < bestKm) {
      bestKm = d;
      best = c;
    }
  }
  return { city: best, km: bestKm };
}

// How far from the nearest listed town a coordinate can be and still count as
// "in the UK". The catalogue is dense enough that anywhere in the country is
// well inside this; the allowance is for offshore waters and the far reaches of
// the Northern Isles. Beyond it the user is abroad, and VenTrack, being a UK-only
// product, shows them London rather than a market it does not cover.
const OUT_OF_MARKET_KM = 250;

/// Resolve a coordinate to the region that should serve it. Always returns one
/// of the curated UK regions: the nearest town when the user is in the country,
/// London when they are abroad or sent no usable coordinate.
export function resolveRegion(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return DEFAULT_REGION;

  const { city, km } = nearestCity(lat, lng);
  if (city && km <= OUT_OF_MARKET_KM) return city;
  return DEFAULT_REGION;
}

/// Whether a coordinate falls inside the market VenTrack serves. The app uses the
/// answer (via /api/events) to explain why an overseas user is seeing London.
export function isInMarket(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const { city, km } = nearestCity(lat, lng);
  return !!city && km <= OUT_OF_MARKET_KM;
}

/// The public shape of a region, as sent to the app.
export function publicRegion(r) {
  return {
    id: r.id,
    label: r.label,
    area: r.area || null,       // county / council area / principal area
    nation: r.nation || null,   // England | Wales | Scotland | Northern Ireland
    country: r.country,
    timeZone: r.timeZone,
    unit: r.unit,
    center: { lat: r.lat, lng: r.lng },
    // How far every source actually searched around `center`. The clients use
    // it as the ceiling on their own "how far to look" control, so the app can
    // never offer a radius wider than the data behind it. Raising a region's
    // radiusKm here widens that control without shipping a new build, the same
    // way /api/regions drives the town picker.
    radiusKm: r.radiusKm,
    // Kept so older builds of the app still decode. VenTrack only ever serves
    // curated UK regions, so it is always false.
    generic: false,
  };
}

// MARK: timezone-aware day maths -------------------------------------------

/// Minutes that `timeZone` is ahead of UTC at `date`. Returns 0 for a bad zone.
export function tzOffsetMinutes(timeZone, date = new Date()) {
  if (!timeZone) return 0;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

/// Offset to use for a region: its real timezone when we know one, otherwise a
/// longitude estimate (15 degrees per hour), which is close enough to bucket
/// "today" and "this weekend" correctly for a generic cell.
export function regionOffsetMinutes(region, date = new Date()) {
  if (region.timeZone) return tzOffsetMinutes(region.timeZone, date);
  return Math.round(region.lng / 15) * 60;
}

// MARK: date-range windows --------------------------------------------------
//
// "Today" and "this weekend" have to mean *the user's* today, not the server's.
// Render runs in UTC, so everything below works in the region's offset (minutes
// ahead of UTC) rather than in server-local time.

/// Start of the local day that `ms` falls in, plus `addDays`, as epoch ms.
///
/// `offsetMin` is the region's UTC offset at the moment we started from. That
/// is not necessarily the offset at the boundary we are computing: the UK
/// changes clocks on the last Sunday of March and October, so a window that
/// spans the change would land an hour out and, for the weekend range, push
/// the end of Sunday into Monday. When a timeZone is supplied we recompute the
/// offset at the candidate instant and correct once, which is enough because
/// the shift is a single hour.
export function localDayStartMs(ms, offsetMin, addDays = 0, timeZone = null) {
  const dayStart = (off) => {
    const d = new Date(ms + off * 60000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + addDays) - off * 60000;
  };
  const first = dayStart(offsetMin);
  if (!timeZone) return first;
  const atBoundary = tzOffsetMinutes(timeZone, new Date(first));
  return atBoundary === offsetMin ? first : dayStart(atBoundary);
}

export function localWeekday(ms, offsetMin) {
  return new Date(ms + offsetMin * 60000).getUTCDay(); // 0 = Sunday
}

/// Returns {min,max} epoch-ms bounds for a named range, or null for "all".
/// Pass the region's timeZone so windows that span a clock change stay on the
/// right days.
export function rangeWindow(range, now, offsetMin = 0, timeZone = null) {
  if (range === "all") return null;
  const t = now.getTime();
  const min = t;
  const dayStart = (add) => localDayStartMs(t, offsetMin, add, timeZone);

  if (range === "today") {
    return { min, max: dayStart(1) - 1 };
  }

  if (range === "week") {
    return { min, max: dayStart(8) - 1 };
  }

  // "weekend": the upcoming (or current) Saturday and Sunday, in local terms.
  const day = localWeekday(t, offsetMin);
  const untilSat = day === 0 ? 0 : (6 - day + 7) % 7; // Sunday: the weekend is today
  const satStart = dayStart(untilSat);
  const sunEnd = dayStart(untilSat + (day === 0 ? 1 : 2)) - 1;
  // Start at Saturday, unless it is already the weekend, in which case start now.
  return { min: Math.max(min, satStart), max: sunEnd };
}

// ---------------------------------------------------------------------------
// Catalogue, for the country picker in the app's settings.
// ---------------------------------------------------------------------------

const COUNTRY_LABELS = { GB: "United Kingdom" };

/// The curated towns grouped by country, in a shape the client can render
/// directly. There is only ever one country here, the UK, but the shape is
/// kept as a list so the app's picker code stays unchanged. Picking the country
/// means "use its first town as my origin", so London is listed first.
export function regionCatalogue() {
  const byCountry = new Map();
  for (const c of CITIES) {
    if (!byCountry.has(c.country)) byCountry.set(c.country, []);
    byCountry.get(c.country).push({
      id: c.id,
      label: c.label,
      area: c.area || null,       // county / council area / principal area
      nation: c.nation || null,   // England, Wales, Scotland, Northern Ireland
      lat: c.lat,
      lng: c.lng,
      unit: c.unit,
      timeZone: c.timeZone,
    });
  }
  return [...byCountry.entries()].map(([country, cities]) => ({
    country,
    label: COUNTRY_LABELS[country] || country,
    cities,
    // The distinct nations present, in the order they first appear, so the app
    // can render section headers without having to know the UK's shape.
    nations: [...new Set(cities.map((c) => c.nation).filter(Boolean))],
  }));
}
