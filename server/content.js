// FENCE: game content. Everything a godown can hold, every suspect, every job.
// Values are in rupees. L = lakh, CR = crore.
const L = 100000;
const CR = 10000000;

const CATEGORIES = {
  watch: 'Watches', camera: 'Cameras', vehicle: 'Vehicles', fashion: 'Fashion',
  art: 'Art', music: 'Music', book: 'Books & Comics', retro: 'Retro Tech',
  kerala: 'Kerala Heritage', collectible: 'Collectibles', sports: 'Sports',
  home: 'Home & Antiques', oddity: 'Oddities', junk: 'Junk', gold: 'Hot Gold',
};

// [name, category, value, peek (vague glimpse), note (what the finder reads), options]
// options: fake = chance it is counterfeit, set = belongs to a set
const ITEMS = [
  // ---------- JUNK ----------
  ['Nokia 3310, still holds charge', 'junk', 1500, 'A small grey phone that refuses to die', 'Snake high score: 4,112. Respect.'],
  ['Box of 1990s VHS tapes', 'junk', 800, 'A cardboard box of black plastic rectangles', 'Mostly cricket highlights and one wedding.'],
  ['Broken ceiling fan', 'junk', 600, 'Three dusty blades poking out of a sack', 'It spins. Once. Then it stops forever.'],
  ['Half-used Gulf duty-free perfume', 'junk', 900, 'A fancy glass bottle catching the light', 'Smells like an uncle at a wedding.'],
  ['Stack of old Balarama comics', 'junk', 1200, 'A tied-up bundle of thin comic books', 'Childhood in a bundle. Worth little, means a lot.'],
  ['Cracked plastic garden chairs', 'junk', 400, 'Stacked chairs in a faded colour', 'Four chairs. Three legs each.'],
  ['Treadmill used as a clothes hanger', 'junk', 4000, 'Something big and mechanical under shirts', 'Never run on. Only hung on.'],
  ['Suitcase full of unpaid electricity bills', 'junk', 100, 'A heavy suitcase, latched shut', 'KSEB would love to meet the owner.'],
  ['Rusty steel almirah, locked', 'junk', 3500, 'A tall steel cupboard with a padlock', 'You break the lock. It is empty. Of course.'],
  ['Mismatched steel tiffin carriers', 'junk', 700, 'A clatter of steel containers', 'Nobody in this house ever returned a tiffin.'],
  ['Wedding album of total strangers', 'junk', 200, 'A thick velvet photo album', 'Very happy people. No idea who.'],
  ['Kerosene lamp collection', 'junk', 1500, 'Glass chimneys glinting in the dark', 'Grandmother kept them for power cuts.'],
  ['Carrom board with no coins', 'junk', 500, 'A big square board leaning on the wall', 'The striker is also missing. And the powder.'],
  ['200 copies of a self-published poetry book', 'junk', 300, 'Shrink-wrapped stacks of a slim book', 'Title: "My Pain, Volume 3". Volumes 1 and 2 not found.'],
  ['Exercise bike with one pedal', 'junk', 2500, 'A frame with a seat and handlebars', 'A New Year resolution, abandoned in January.'],
  ['Expired Tang sachets from 2009', 'junk', 150, 'A carton of bright orange packets', 'Brought from Dubai with love. Never opened.'],
  ['Inflatable boat with a slow leak', 'junk', 1800, 'A rolled-up rubber thing with a pump', 'Perfect for the monsoon. For about four minutes.'],
  ['A dozen broken umbrellas', 'junk', 300, 'A bucket of black spokes', 'Every monsoon claimed one.'],
  ['Old CRT television', 'junk', 2000, 'A boxy television with a wooden finish', 'Still has the Sunday movie channel stuck on.'],
  ['Cassette tapes labelled "Gulf Songs Mix"', 'junk', 600, 'A shoebox of tapes with handwritten labels', 'Side B is someone singing badly in a car.'],
  ['Ambassador car door, white', 'junk', 2500, 'A white curved metal panel', 'Just the door. The rest of the car is a mystery.'],
  ['Cracked aquarium with a plastic diver', 'junk', 800, 'A glass tank catching light', 'The diver has seen things.'],
  ["Reader's Digest stack, 1987 to 1994", 'junk', 900, 'A tower of small fat magazines', 'Laughter, the Best Medicine. Every issue.'],
  ['Karaoke machine that only plays one song', 'junk', 1500, 'A speaker with a microphone attached', 'The song is "My Heart Will Go On". Forever.'],
  ['Broken harmonium', 'junk', 3000, 'A wooden box with bellows', 'Three keys still make a sound. All of them sad.'],
  ['Hero bicycle with no chain', 'junk', 1800, 'Handlebars and a bell', 'Ring ring. Goes nowhere.'],
  ['Bag of 1,000 bottle caps', 'junk', 200, 'A sack that rattles', 'Someone was saving these for something. Nobody knows what.'],
  ['Wedding sherwani, slightly singed', 'junk', 1200, 'Gold embroidery under a plastic cover', 'There is a story here. A firecracker story.'],
  ['Pressure cooker with no whistle', 'junk', 700, 'A dented aluminium pot', 'Three whistles. Then silence. Forever.'],
  ['Mosquito bat collection', 'junk', 400, 'Tennis-racket shapes with wire mesh', 'A family at war with mosquitoes. They lost.'],
  ['Box of old SIM cards', 'junk', 300, 'A small tin that rattles', 'Forty SIM cards. That is a lot of phone numbers to hide.'],
  ['Plastic Christmas star, giant', 'junk', 600, 'A huge pointy shape wrapped in plastic', 'It lit up the whole lane every December.'],

  // ---------- DECENT FINDS ----------
  ['HMT Janata watch in its original box', 'watch', 18000, 'A small box with a watch brand you half recognise', 'The watch an entire generation got for passing exams.'],
  ['Bajaj Chetak scooter, needs work', 'vehicle', 35000, 'A rounded scooter shape under a sheet', 'Tilt it to start it. Every Malayali dad knows the trick.'],
  ['Wind-up gramophone with 20 records', 'music', 45000, 'A brass horn sticking out of a crate', 'Still plays. Crackles like monsoon rain.'],
  ['Aranmula metal mirror', 'kerala', 60000, 'Something wrapped in red silk, very carefully', 'A mirror of polished metal, made by one family in one village.'],
  ['Original Kathakali mask', 'kerala', 25000, 'A painted face staring from a box', 'Green face, red lips, watching you.'],
  ['Box of Travancore-era coins', 'kerala', 55000, 'A tin that rattles with metal', 'Copper and silver from the old kingdom.'],
  ['1970s Malayalam film reel in a tin', 'kerala', 40000, 'A round metal can, rusted at the edges', 'A lost song sequence. Film archives would want this.'],
  ['Temple-size brass uruli', 'kerala', 70000, 'A huge shallow metal bowl', 'You could cook payasam for 300 in this.'],
  ['Rosewood planter\'s chair', 'home', 65000, 'A long wooden chair with extended arms', 'The arms swing out so you can put your feet up. Colonial lazy.'],
  ['Sony Walkman TPS-L2, the very first one', 'retro', 80000, 'A blue and silver cassette player', 'The one that started it all. Two headphone jacks.'],
  ['Polaroid SX-70 camera', 'camera', 30000, 'A folded leather and chrome object', 'It unfolds like a little machine from the future.'],
  ['Valve radio, 1950s', 'music', 28000, 'A wooden box with a big dial', 'The whole street once gathered around this for cricket.'],
  ['Remington typewriter, 1950s', 'home', 22000, 'Something with keys, heavy as a stone', 'The ribbon still has ink. And secrets.'],
  ['NES console with 10 cartridges', 'retro', 35000, 'A grey box and some grey cartridges', 'Blow on the cartridge. It works now.'],
  ['Cricket bat signed by the 1983 World Cup squad', 'sports', 90000, 'A cricket bat covered in ink', 'Every signature from the team that changed Indian cricket.'],
  ['Vintage Ray-Ban Aviators', 'fashion', 20000, 'A small case with a famous logo', 'Gold frames. Very 1986.', { fake: 0.4 }],
  ['Restored Raleigh bicycle', 'vehicle', 25000, 'Shiny spokes in the corner', 'Someone loved this bike. Leather seat, brass bell.'],
  ['Small bronze Nataraja statue', 'art', 75000, 'A dancing figure in dark metal', 'Heavy, old and beautifully made.'],
  ['Amar Chitra Katha first prints', 'book', 30000, 'Comics in plastic sleeves', 'Early prints, carefully kept. Someone knew.'],
  ['Freshwater pearl necklace', 'fashion', 40000, 'Something white and round glowing in a pouch', 'Real pearls. Probably.', { fake: 0.4 }],
  ['German cuckoo clock', 'home', 35000, 'A carved wooden house with a little door', 'The bird comes out and screams at midnight.'],
  ['Zippo lighter collection', 'collectible', 22000, 'A tray of small metal rectangles', '42 lighters. One from every port a sailor visited.'],
  ['Neon "CHAYA" sign from a tea shop', 'kerala', 30000, 'Glass tubes bent into letters', 'Still lights up in pink. Instant cafe vibes.'],
  ['Petromax lantern collection', 'kerala', 20000, 'Brass lanterns with mantles', 'Festival nights before electricity.'],
  ['8-gram gold coin', 'collectible', 55000, 'A tiny box that feels heavy', 'Clean, legal gold. Bill included. Rare in this city.'],
  ['Model of a Chinese fishing net', 'kerala', 12000, 'A wooden contraption with strings', 'A perfect miniature of the Fort Kochi nets.'],
  ['Mappila Pattu record collection', 'music', 20000, 'A crate of vinyl in paper sleeves', 'Old Malabar songs, some never digitised.'],
  ['Grandfather clock', 'home', 60000, 'A tall wooden case taller than you', 'It chimes every hour. Loudly. Even at 3am.'],
  ['Trunk of six Kanjeevaram silk sarees', 'fashion', 90000, 'Silk and gold thread folded in a trunk', 'Wedding sarees. Real zari.'],
  ['Undeveloped film rolls', 'oddity', 8000, 'A bag of small canisters', 'Twelve rolls of film nobody ever developed.'],
  ['Ship in a bottle collection', 'collectible', 18000, 'Glass bottles with tiny masts inside', 'How did they get in there? Nobody will ever know.'],
  ['Antique bronze tharavad lamp', 'kerala', 85000, 'A tall branched lamp, green with age', 'Lit every evening for a hundred years in an old family house.'],
  ['Vintage Vespa, 1960s', 'vehicle', 95000, 'Curved metal and a round headlight', 'Roman Holiday energy. Needs a new clutch.'],
  ['Box of first day covers and stamps', 'collectible', 15000, 'Envelopes in a shoebox', 'A careful collector. Nothing rare. Probably.'],

  // ---------- BIG FINDS ----------
  ['Royal Enfield Bullet engine, 1965', 'vehicle', 70000, 'A greasy engine block on a pallet', 'Part of a 1965 Bullet. Find the frame and tank for the full bike.', { set: 'bullet' }],
  ['Royal Enfield Bullet frame, 1965', 'vehicle', 60000, 'A motorbike frame hung on hooks', 'Part of a 1965 Bullet. Find the engine and tank for the full bike.', { set: 'bullet' }],
  ['Royal Enfield Bullet fuel tank, 1965', 'vehicle', 50000, 'A curved metal tank with chrome badges', 'Part of a 1965 Bullet. Find the engine and frame for the full bike.', { set: 'bullet' }],
  ['Leica M3 film camera', 'camera', 2.2 * L, 'A small camera with a red dot', 'German precision from 1954. Photographers would fight for this.'],
  ['Sealed original Game Boy, 1989', 'retro', 3 * L, 'A colourful box, still in plastic', 'Never opened. Never played. Collectors cry over this.'],
  ['Air Jordan 1s from 1985, in the box', 'fashion', 9 * L, 'An old shoebox with a red and black logo', 'The original sneaker drop. If real, this is a fortune.', { fake: 0.4 }],
  ['Vintage Louis Vuitton steamer trunk', 'fashion', 12 * L, 'A big brown trunk with a famous pattern', 'The kind that sailed on ocean liners.', { fake: 0.35 }],
  ['Hermès Birkin bag', 'fashion', 18 * L, 'An orange box with a ribbon', 'Waiting lists for this bag last years.', { fake: 0.45 }],
  ['Vintage Rolex Submariner', 'watch', 15 * L, 'A heavy steel watch with a black dial', 'The diver\'s watch. If it is real.', { fake: 0.45 }],
  ['Vintage Omega Speedmaster', 'watch', 6 * L, 'A chunky watch with three small dials', 'The moon watch. Astronauts wore this one.', { fake: 0.4 }],
  ['Willys Jeep, 1950s', 'vehicle', 4 * L, 'A boxy green shape with a spare tyre', 'Needs restoration. Plantation owners loved these.'],
  ['Ambassador Mark I, 1958', 'vehicle', 3.5 * L, 'A rounded white car nose', 'The original. Before every government office had one.'],
  ['1970s Gibson Les Paul guitar', 'music', 9 * L, 'A guitar case covered in stickers', 'Sunburst finish. Played in a Kochi rock band.', { fake: 0.35 }],
  ['Original Macintosh 128K, boxed', 'retro', 4 * L, 'A beige box with a rainbow logo', 'The first Mac. 1984. Still in the box.'],
  ['Montblanc limited edition pen', 'collectible', 3 * L, 'A long black velvet case', 'A writer\'s instrument. Numbered edition.', { fake: 0.4 }],
  ['19th century Tanjore painting', 'art', 8 * L, 'A gold-glinting frame under a cloth', 'Real gold leaf on an old painting.'],
  ['Signed first edition of "Chemmeen"', 'book', 5 * L, 'An old hardback with a cracked spine', 'Signed by Thakazhi himself. Literature in your hands.'],
  ['Vintage Cartier Tank watch', 'watch', 7 * L, 'A slim rectangular watch', 'Elegant, square, very expensive. Maybe.', { fake: 0.45 }],
  ['Persian silk rug', 'home', 10 * L, 'A rolled carpet that shimmers', 'Hand-knotted. Or machine-made in a factory.', { fake: 0.4 }],
  ['Pair of Tiffany lamps', 'home', 12 * L, 'Coloured glass shades glowing faintly', 'Stained glass dragonflies. Gorgeous if genuine.', { fake: 0.4 }],
  ['Arriflex film camera from a 1980s Malayalam set', 'camera', 6 * L, 'A big professional camera on a tripod', 'This camera shot a classic. The tin says so.'],
  ['First-print Tintin albums in French', 'book', 4.5 * L, 'A row of large hardback comics', 'Early French printings. Tintin collectors pay serious money.'],
  ['Signed Sachin Tendulkar Test jersey', 'sports', 7 * L, 'A white jersey in a frame', 'Number 10. Signed. Framed.', { fake: 0.35 }],
  ['1.5 carat diamond engagement ring', 'fashion', 11 * L, 'A tiny velvet box', 'A sparkling stone. Diamond or glass?', { fake: 0.45 }],
  ['Ceremonial Travancore royal sword', 'kerala', 9 * L, 'A long curved shape wrapped in cloth', 'Silver hilt. From the royal household, says the tag.'],
  ['Painted Theyyam headdress', 'kerala', 1.5 * L, 'A huge red and gold crown-like shape', 'The god\'s own crown, from North Malabar.'],
  ['Travancore gold kasu coins', 'kerala', 3.5 * L, 'A velvet pouch, surprisingly heavy', 'Tiny royal gold coins. Real history.'],
  ['Vintage Hasselblad camera', 'camera', 3 * L, 'A cube-shaped camera with a crank', 'The camera brand that went to the moon.'],
  ['Rare Bombay Talkies film poster set', 'art', 2 * L, 'A tube of rolled paper', 'Hand-painted posters from the golden age of Indian film.'],
  ['Jukebox, 1960s, working', 'music', 6 * L, 'Chrome and coloured lights under a sheet', 'Drop a coin. Elvis plays. In Mattancherry.'],
  ['Ravi Varma Press print: Lakshmi', 'art', 45000, 'A framed print, colours still bright', 'One of three famous prints from the 1890s press. Find Saraswati and Shakuntala to complete the set.', { set: 'oleo' }],
  ['Ravi Varma Press print: Saraswati', 'art', 45000, 'A framed print with a veena in it', 'One of three famous prints from the 1890s press. Find Lakshmi and Shakuntala to complete the set.', { set: 'oleo' }],
  ['Ravi Varma Press print: Shakuntala', 'art', 45000, 'A framed print of a woman looking back', 'One of three famous prints from the 1890s press. Find Lakshmi and Saraswati to complete the set.', { set: 'oleo' }],
  ['Vintage Gulf suitcase: the brown one', 'collectible', 15000, 'A brown hard suitcase with airline stickers', 'One of a matching three-piece set that flew Dubai to Kochi in 1981. Find the other two.', { set: 'luggage' }],
  ['Vintage Gulf suitcase: the big one', 'collectible', 18000, 'A huge suitcase with a rope tied around it', 'One of a matching three-piece set that flew Dubai to Kochi in 1981. Find the other two.', { set: 'luggage' }],
  ['Vintage Gulf suitcase: the vanity case', 'collectible', 12000, 'A small square case with a mirror inside', 'One of a matching three-piece set that flew Dubai to Kochi in 1981. Find the other two.', { set: 'luggage' }],

  // ---------- JACKPOTS ----------
  ['First-print Harry Potter hardback', 'book', 60 * L, 'A small hardback with a wizard boy on the cover', 'One of the first 500 copies. Collectors fight wars over these.'],
  ['Meteorite fragment with certificate', 'oddity', 45 * L, 'A dark, pitted rock in a glass case', 'It fell from space. The certificate is real.'],
  ['1972 Mercedes-Benz 280SL', 'vehicle', 55 * L, 'A long low car under a dusty tarp', 'The Pagoda. Original paint. Somebody hid a dream car here.'],
  ['Patek Philippe Calatrava', 'watch', 40 * L, 'A slim gold watch on a leather strap', 'The watch of kings and CEOs.', { fake: 0.5 }],
  ['Violin labelled "Stradivarius"', 'music', 80 * L, 'An old violin case, the leather cracked', 'The label inside says Stradivarius. Thousands of violins say that.', { fake: 0.85 }],
];

// Hidden gems look like junk until appraised.
const GEMS = [
  { apparent: 'Dusty oil painting of a woman in a saree', peek: 'A dirty painting in a broken frame', apparentValue: 3000, trueName: 'Original Raja Ravi Varma oil painting', trueValue: 1.5 * CR, cat: 'art', note: 'Faded. Dirty. Strangely beautiful.' },
  { apparent: 'Old comic in a plastic sleeve', peek: 'A thin comic in plastic', apparentValue: 500, trueName: 'Mint first-issue comic from 1962', trueValue: 25 * L, cat: 'book', note: 'Kept very carefully for an old comic.' },
  { apparent: 'Ugly brass paperweight', peek: 'A lumpy dark paperweight', apparentValue: 400, trueName: 'Iron meteorite, 1.2 kg', trueValue: 12 * L, cat: 'oddity', note: 'Weirdly heavy for its size.' },
  { apparent: 'Box of old stamps', peek: 'An envelope stuffed with stamps', apparentValue: 1500, trueName: 'Stamps including a 1948 Gandhi "Service" overprint', trueValue: 40 * L, cat: 'collectible', note: 'Mostly common stamps. Mostly.' },
  { apparent: 'Grandmother\'s costume necklace', peek: 'A tangle of beads in a jar', apparentValue: 2000, trueName: 'Antique Basra pearl necklace', trueValue: 18 * L, cat: 'fashion', note: 'Cheap looking beads. Odd lustre.' },
  { apparent: 'Old video game cartridge', peek: 'A grey game cartridge in plastic', apparentValue: 1000, trueName: 'Factory-sealed 1985 Super Mario Bros.', trueValue: 30 * L, cat: 'retro', note: 'Still has the original seal. Hmm.' },
  { apparent: 'Tin of old coins', peek: 'A biscuit tin that clinks', apparentValue: 800, trueName: 'Coin tin with an 1835 East India Company gold mohur', trueValue: 9 * L, cat: 'collectible', note: 'Mostly old paisa. One coin is a different colour.' },
  { apparent: 'Rusted motorcycle frame', peek: 'Rusty tubes in the shape of a bike', apparentValue: 2000, trueName: 'Frame of a 1940s Vincent Black Shadow', trueValue: 25 * L, cat: 'vehicle', note: 'Odd design. Not Indian.' },
];

// Hot goods from the Kerala State Bank vault. Only Chacko will buy them.
const HOT = [
  ['Gold biscuits stamped "KSB"', 8 * L, 'Something gleaming under a false floorboard', 'Ten tola bars with the bank\'s stamp ground half off.'],
  ['Bank cloth bag of old notes', 6 * L, 'A heavy cloth bag with a bank seal', 'Bundles of notes with Kerala State Bank paper bands.'],
  ['Temple-style gold necklace from the vault', 12 * L, 'A glint of gold in a betel box', 'Listed in the police report as stolen. Very recognisable.'],
  ['Gold bangles, a whole tray', 7 * L, 'Something jangling in a steel box', 'Thirty bangles, tagged with bank locker numbers.'],
  ['Sovereign gold coins in a pickle jar', 9 * L, 'A pickle jar that is far too heavy', 'Mango pickle on top. Gold underneath.'],
  ['Diamond earrings in a matchbox', 10 * L, 'A matchbox that sparkles when shaken', 'Listed as stolen from locker 112.'],
];

const SUSPECTS = [
  { id: 'tharakan', name: 'Mathew Tharakan', title: 'Tea estate owner, Munnar', emoji: '🍃',
    evidence: ['Tea chest stamped "Tharakan Estates, Munnar"', 'Hill club membership card with the name scratched off', 'Estate letterhead note: "The rain will cover everything."'],
    alibi: 'Mathew Tharakan was in hospital in Vellore that week. Records confirm it.' },
  { id: 'pillai', name: 'Vijayan Pillai', title: 'Film producer', emoji: '🎬',
    evidence: ['Clapperboard from the film "Monsoon Raja"', 'Studio gate pass for Ocean Pictures', 'A screenplay with the bank\'s floor plan sketched on the back'],
    alibi: 'Vijayan Pillai was shooting in Ooty with 80 crew members as witnesses.' },
  { id: 'varghese', name: 'Kunjumon Varghese', title: 'Gold merchant, Thrissur', emoji: '💍',
    evidence: ['Jeweller\'s loupe engraved "K.V."', 'Gold refinery receipt dated the day after the robbery', 'Gold weighing scale with a Thrissur shop seal'],
    alibi: 'Kunjumon Varghese was robbed himself that same week. Nobody funds a heist while their own shop is being emptied.' },
  { id: 'kuttan', name: 'Sukumaran Kuttan', title: 'Toddy shop baron, Chalakudy', emoji: '🥥',
    evidence: ['Matchbox from Kuttan\'s Toddy Shop, Chalakudy', 'Toddy shop ledger with bank account numbers in the margin', 'Clay toddy pot with a vault key hidden inside'],
    alibi: 'Sukumaran Kuttan was in Dubai jail that month. Long story.' },
  { id: 'rahiman', name: 'Abdul Rahiman', title: 'Gulf-returned businessman', emoji: '✈️',
    evidence: ['Dubai duty-free bag hiding a Kerala State Bank cash band', 'Boarding pass Dubai to Kochi, the night of the robbery', 'Business card: "Rahiman Trading LLC, Deira"'],
    alibi: 'Abdul Rahiman\'s passport shows he was in Riyadh for three months.' },
  { id: 'gopinath', name: 'R. Gopinath', title: 'Retired police commissioner', emoji: '🎖️',
    evidence: ['A polished police cap badge', 'Duty roster showing patrols pulled from Ernakulam that night', 'Retirement plaque with a vault key taped behind it'],
    alibi: 'R. Gopinath was leading a VIP security detail all night. Two hundred officers saw him.' },
  { id: 'fernandez', name: 'Shaji Fernandez', title: 'Fishing fleet owner, Neendakara', emoji: '⛵',
    evidence: ['Boat log: one boat went out during the cyclone warning', 'Net float stamped "Fernandez Fleets"', 'Ice factory receipt for 400 kg of "fish". No fish were bought.'],
    alibi: 'Shaji Fernandez\'s whole fleet was docked under a harbour ban. The port logs prove it.' },
  { id: 'moothedan', name: 'Babu Moothedan', title: 'Local party fixer', emoji: '📢',
    evidence: ['Election poster with a phone number on the back', 'Khadi shirt with a bank teller\'s ID in the pocket', 'Party fund receipt book, pages torn out'],
    alibi: 'Babu Moothedan was on stage at a rally in Kannur. It was on the evening news.' },
  { id: 'menon', name: 'Leela Menon', title: 'Houseboat tycoon, Alappuzha', emoji: '🛶',
    evidence: ['Houseboat register: one boat booked "private" on the robbery night', 'Keychain shaped like a snake boat', 'Backwater map with the bank circled in red'],
    alibi: 'Leela Menon was at her daughter\'s wedding in London. Four hundred guests.' },
  { id: 'kunju', name: 'Hameed Kunju', title: 'Cashew exporter, Kollam', emoji: '🥜',
    evidence: ['Cashew export crate stamped "Kollam"', 'Shipping manifest: 40 kg "roasted cashew" to Singapore, far too heavy', 'Cashew factory ID card'],
    alibi: 'Hameed Kunju was being audited by customs that month. They watched him daily.' },
  { id: 'varma', name: 'Dr. Saraswathi Varma', title: 'Ayurveda resort owner, Kovalam', emoji: '🌿',
    evidence: ['Resort brochure with a note: "Room 7, after the storm"', 'Bottle of medicinal oil hiding a roll of microfilm', 'Spa towel embroidered "SV"'],
    alibi: 'Dr. Saraswathi Varma was treating a minister at her resort. His security detail vouches for her.' },
  { id: 'ramachandran', name: 'K.P. Ramachandran', title: 'Former bank branch manager', emoji: '🏦',
    evidence: ['Kerala State Bank staff ID, Ernakulam branch', 'Pocket diary with the vault combination scribbled inside', 'Farewell card: "We will never forget what you did for us"'],
    alibi: 'K.P. Ramachandran was locked inside the vault by the robbers. He was the hostage.' },
  { id: 'sait', name: 'Ibrahim Sait', title: 'Spice trader, Mattancherry', emoji: '🌶️',
    evidence: ['Pepper sack stamped "Sait & Sons, Mattancherry"', 'Godown lease book listing all the crew\'s fake names', 'Brass scale weights, hollowed out'],
    alibi: 'Ibrahim Sait was on Hajj that month. Thousands of pilgrims, one very visible man.' },
  { id: 'mathai', name: 'Kurian Mathai', title: 'Rubber planter, Kottayam', emoji: '🌳',
    evidence: ['Bundle of rubber sheets with gold leaf pressed inside', 'Kottayam club tie, slightly stained', 'Plantation jeep logbook: 300 km driven that night'],
    alibi: 'Kurian Mathai broke both legs in a jeep accident a week before. He could not walk.' },
  { id: 'stephen', name: 'Lottery Stephen', title: 'Lottery agent king', emoji: '🎟️',
    evidence: ['Bundle of Kerala lottery tickets, all winners', 'Lottery office receipt used to launder cash', 'Lucky numbers list that matches the vault combination'],
    alibi: 'Lottery Stephen was live on TV drawing the Onam bumper that night.' },
  { id: 'raghavan', name: 'Gurukkal Raghavan', title: 'Kalaripayattu master', emoji: '🥋',
    evidence: ['Oil-stained kalari staff with a hollow handle', 'Training ground map with an escape tunnel drawn in', 'Student list: three names match the vanished crew'],
    alibi: 'Gurukkal Raghavan was performing in Delhi for Republic Day.' },
];

// Heist targets. tier 1 = Act 1, tier 2 = Act 2. The finale is fixed.
const HEISTS = [
  { id: 'chitfund', tier: 1, name: 'The Chit Fund Office', place: 'Thrissur', short: 'chit fund office', loot: [14 * L, 22 * L], pitch: 'Fifty families pay into this chit fund every month. The manager keeps the cash in a safe behind a calendar of Lord Ayyappa.' },
  { id: 'round', tier: 1, name: 'Jeweller on the Round', place: 'Thrissur', short: 'jeweller', loot: [16 * L, 26 * L], pitch: 'A jewellery shop on Swaraj Round. After closing, one guard and one very old alarm.' },
  { id: 'pawn', tier: 1, name: 'The Pawnbroker\'s Vault', place: 'Kottayam', short: 'pawnbroker', loot: [12 * L, 20 * L], pitch: 'Half of Kottayam has pawned their gold here. The vault is in the basement, under the photocopy shop.' },
  { id: 'estate', tier: 1, name: 'The Estate Manager\'s Safe', place: 'Munnar', short: 'estate safe', loot: [14 * L, 22 * L], pitch: 'Payday cash for 600 tea pickers, sitting in a safe in a misty bungalow on a hill.' },
  { id: 'wedding', tier: 1, name: 'The 2,000-Guest Wedding', place: 'Kochi', short: 'wedding hall', loot: [15 * L, 25 * L], pitch: 'A wedding hall in Kochi. The gift envelopes and the bride\'s gold are kept in the green room. Biryani as cover.' },
  { id: 'cashew', tier: 1, name: 'The Cashew Factory Safe', place: 'Kollam', short: 'cashew factory', loot: [12 * L, 20 * L], pitch: 'An export house with a safe full of advance payments from buyers abroad.' },
  { id: 'houseboat', tier: 2, name: 'The Hawala Houseboat', place: 'Alappuzha', short: 'houseboat', loot: [30 * L, 45 * L], pitch: 'A luxury houseboat that never takes tourists. It carries hawala cash between Gulf money and Kerala hands.' },
  { id: 'vizhinjam', tier: 2, name: 'Container 4417', place: 'Vizhinjam Port', short: 'shipping container', loot: [32 * L, 48 * L], pitch: 'One shipping container at the new port has no paperwork and very good locks.' },
  { id: 'studio', tier: 2, name: 'The Film Studio Vault', place: 'Kochi', short: 'film studio', loot: [30 * L, 45 * L], pitch: 'A producer keeps black money in a vault behind the set of a village temple festival.' },
  { id: 'smuggler', tier: 2, name: 'The Smuggler\'s Flat', place: 'Kozhikode', short: 'smuggler\'s flat', loot: [34 * L, 50 * L], pitch: 'A gold smuggler\'s flat by the beach. Customs have been watching it for months. So have you.' },
  { id: 'dutyfree', tier: 2, name: 'The Airport Strongroom', place: 'Kochi Airport', short: 'airport strongroom', loot: [35 * L, 50 * L], pitch: 'The duty-free strongroom at the airport, where seized gold waits for paperwork.' },
  { id: 'counting', tier: 2, name: 'The Toddy Baron\'s Counting Room', place: 'Chalakudy', short: 'counting room', loot: [30 * L, 44 * L], pitch: 'Every toddy shop in the district sends its cash here every Sunday night.' },
];

const FINAL_HEIST = { id: 'tharavad', tier: 3, name: 'The Godfather\'s Tharavad', place: 'A nalukettu outside Kochi', short: 'tharavad', loot: [60 * L, 90 * L], pitch: 'The Godfather\'s ancestral house. Under the central courtyard, behind the pooja room, the rest of the Kerala State Bank loot is waiting.' };

const ROUTES = [
  'NH66 highway', 'The market lanes', 'The backwater ferry', 'The railway crossing', 'The coastal road',
  'The ghat road', 'The fishing harbour', 'The temple road', 'The old bridge', 'The canal path',
];

const LEASE_NAMES = [
  'P. Joseph', 'Mr. K. Nair', 'A. Thomas', 'Babu & Sons', 'S. Kumar Traders', 'M.K. Enterprises',
  'Raju Moideen', 'T.V. George', 'Sri Durga Stores', 'Mrs. L. Pillai', 'Kochi Export House', 'R. Menon',
  'Anil Varkey', 'Gulf Star Trading', 'A. Rahman', 'Lakshmi Agencies', 'Jose Kutty', 'Unknown tenant',
];

const FACILITIES = [
  'Bazaar Road Godowns, Mattancherry', 'Jew Town Warehouse 3', 'Calvathy Canal Store', 'Old Pepper Godown, Fort Kochi',
  'Willingdon Island Storage', 'Kalvathi Road Lockups', 'Spice Market Lane, Block C', 'Harbour Gate Godowns',
];

const RUMOURS = [
  'I heard it got flooded in 2018. Everything is rotten.',
  'Someone saw gold go in there. Late at night.',
  'It is empty. The tenant moved everything out last year.',
  'The lease name is one of the old crew\'s aliases.',
  'Customs have been watching this one.',
  'My cousin says there is a car in there.',
  'Total junk. Not worth a rupee.',
  'Whoever wins this is going to be very rich.',
];

const EVENTS = [
  { id: 'flood', title: 'Monsoon flood', text: 'Overnight rain flooded Mattancherry. Everything in this godown is worth 40% less.', },
  { id: 'hartal', title: 'Hartal!', text: 'A hartal has been called. The dealers and Chacko are closed this round. Only player trades work.' },
  { id: 'onam', title: 'Onam season', text: 'It is Onam. Kerala heritage items and home antiques sell for 50% more this round.' },
  { id: 'goldspike', title: 'Gold price spike', text: 'Gold prices just shot up. Chacko is paying double for hot goods this round.' },
  { id: 'customs', title: 'Customs raid', text: 'Customs officers are sweeping the city. Anyone holding hot goods right now gains heat.' },
  { id: 'gulfbuyer', title: 'Gulf buyers in town', text: 'Rich buyers from Dubai are shopping. Watches, fashion and cameras sell for 50% more this round.' },
  { id: 'taxman', title: 'The taxman cometh', text: 'Income tax officers visit every dealer. Everyone pays 5% of their cash.' },
];

// Secret side missions. {target} is replaced with another player's name.
const MISSIONS = [
  { id: 'win3', text: 'Win at least 3 godowns.' },
  { id: 'crew2', text: 'Be on at least 2 heist crews.' },
  { id: 'solograb', text: 'Grab during a split and be the only one who grabbed.' },
  { id: 'raidtarget', text: 'Make sure {target} gets raided at least once.', needsTarget: true },
  { id: 'lowheat', text: 'Finish the game with heat under 30.' },
  { id: 'chacko2', text: 'Sell at least 2 hot items to Chacko.' },
  { id: 'lastgodown', text: 'Win the Last Godown.' },
  { id: 'set', text: 'End the game owning a complete set.' },
  { id: 'bigitem', text: 'End the game owning an item worth ₹10 lakh or more.' },
  { id: 'planner', text: 'Plan at least one heist that is not busted.' },
  { id: 'spender', text: 'Spend more than ₹20 lakh at auctions.' },
  { id: 'tipper', text: 'Tip off the police and have that crew get busted.' },
  { id: 'buyer', text: 'Buy at least one item from another player.' },
  { id: 'richer', text: 'End the game with more cash than {target}.', needsTarget: true },
];

const STORY = {
  intro: [
    'Kochi. Fifteen years ago.',
    'A monsoon night. A citywide power cut. And a five-person crew walked into the vault of the Kerala State Bank in Ernakulam.',
    'They took gold biscuits. Temple jewellery. And a ledger of hawala accounts that could bring down half the city.',
    'The whole job was paid for by one man. Nobody knows his name. The crew only called him the Godfather.',
    'They hid the loot in old godowns in Mattancherry, under fake names. Then they vanished.',
    'This month, the rent stopped being paid.',
    'You are small-time godown dealers. Everyone starts with ₹10 lakh. Buy godowns, sell what is inside, and the richest person at the end wins.',
    'And keep your eyes open. There may be a Rat among you.',
  ],
  act1: ['Act One', 'The First Godowns', 'Each godown gives every one of you a different private peek. Nobody sees the whole thing. Bid smart. Bluff harder.'],
  act2: ['Act Two', 'The Heat', 'The police noticed that heist. From now on, everyone has heat, and only you can see yours.',
    'Some godowns now hold hot gold from the bank job. Normal dealers will not touch it. Chacko, the scrap yard man in Aluva, pays full price and asks no questions. Every sale raises your heat.',
    'You can pay off a constable to lower your heat. You can also whisper anonymous rumours during auctions.',
    'At the end of this act, the police raid the people they suspect most.'],
  act3: ['Act Three', 'The Last Godown', 'One godown is left. Everyone in Kochi says the main stash is inside. After that, the Godfather\'s own house.',
    'Anything you still own at the end counts at its true value. Hot goods get seized. Fakes are worth nothing.'],
};

const SETS = {
  bullet: '1965 Royal Enfield Bullet',
  oleo: 'Ravi Varma Press prints',
  luggage: '1981 Gulf luggage set',
};

module.exports = { L, CR, SETS, CATEGORIES, ITEMS, GEMS, HOT, SUSPECTS, HEISTS, FINAL_HEIST, ROUTES, LEASE_NAMES, FACILITIES, RUMOURS, EVENTS, MISSIONS, STORY };
