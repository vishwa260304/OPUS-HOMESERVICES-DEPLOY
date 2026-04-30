import React, { useMemo, useState, useLayoutEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import DateTimePicker from '../../components/DateTimePicker';
import Toast from '../../components/Toast';

type Product = {
  id: number;
  title: string;
  rating: string;
  time: string;
  image: any;
  category: string;
  price: string;
  description: string;
};

// Minimal dataset matching the Popular Services on the home screen
const PRODUCTS: Product[] = [
  { id: 1, title: 'AC Repair', rating: '0', time: 'in 2 hrs', image: require('../../assets/images/appliance.jpg'), category: 'Appliances', price: '₹499', description: 'Comprehensive AC inspection and quick repair by verified professionals.' },
  { id: 3, title: 'Home Cleaning', rating: '0', time: 'in 3 hrs', image: require('../../assets/images/homecleaning.jpg'), category: 'Home', price: '₹1499', description: 'Deep cleaning for your home spaces with eco-friendly supplies.' },
  { id: 4, title: 'Plumbing', rating: '0', time: 'in 1 hr', image: require('../../assets/images/pluming.jpg'), category: 'Home', price: '₹299', description: 'On-demand plumbing fixes for leaks, clogs, and installations.' },
  { id: 5, title: 'Electrician', rating: '0', time: 'in 2 hrs', image: require('../../assets/images/electician.jpg'), category: 'Home', price: '₹349', description: 'Certified electricians for repairs, fittings, and safety checks.' },
];

// Fallback image map for subcategory items keyed by title
const IMAGE_MAP: Record<string, any> = {
  'AC Repair & Service': require('../../assets/images/acservice.webp'),
  'Washing Machine Repair': require('../../assets/images/washingmachinerepair.png'),
  'Refrigerator Repair': require('../../assets/images/refrigeratorservvice.png'),
  'Television Repair': require('../../assets/images/televisionrepair.png'),
  'Geyser Repair': require('../../assets/images/geyserservice.png'),
  'Bike Complete Service': require('../../assets/images/bikerepair.png'),
  'Car Exterior Wash': require('../../assets/images/carwash.png'),
  'Rapid Puncture Repair': require('../../assets/images/punctureservice.png'),
  'Acting Driver Service': require('../../assets/images/actingdriver.png'),
  'Pest Control & Waterproofing': require('../../assets/images/pest.png'),
  'Garden Maintenance': require('../../assets/images/garden.png'),
  'Ironing': require('../../assets/images/iron.png'),
  'Interior Design': require('../../assets/images/interior.png'),
};

const IMAGE_KEY_MAP: Record<string, any> = {
  acservice: require('../../assets/images/acservice.webp'),
  washingmachinerepair: require('../../assets/images/washingmachinerepair.png'),
  refrigeratorservvice: require('../../assets/images/refrigeratorservvice.png'),
  televisionrepair: require('../../assets/images/televisionrepair.png'),
  geyserservice: require('../../assets/images/geyserservice.png'),
  bikerepair: require('../../assets/images/bikerepair.png'),
  carwash: require('../../assets/images/carwash.png'),
  punctureservice: require('../../assets/images/punctureservice.png'),
  actingdriver: require('../../assets/images/actingdriver.png'),
  pest: require('../../assets/images/pest.png'),
  garden: require('../../assets/images/garden.png'),
  iron: require('../../assets/images/iron.png'),
  interior: require('../../assets/images/interior.png'),
};

const formatRating = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : '—';
};

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string; description?: string; price?: string; time?: string; category?: string; rating?: string; imageKey?: string; imageUri?: string }>();
  const { id } = params;
  const router = useRouter();
  const navigation = useNavigation();
  const { addToCart, getTotalItems } = useCart();
  const { colors } = useTheme();
  const [showBooking, setShowBooking] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Hide the header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const product: Product | undefined = useMemo(() => {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return undefined;
    return PRODUCTS.find(p => p.id === numericId);
  }, [id]);

  // Build from params if not found in predefined list
  const derivedProduct: Product | undefined = useMemo(() => {
    // Build from params when provided, regardless of numeric id collisions
    const hasParamData = typeof params.title === 'string' || typeof params.imageKey === 'string' || typeof params.imageUri === 'string';
    if (!hasParamData) return undefined;
    const title = typeof params.title === 'string' ? params.title : 'Service';
    const imageFromKey = typeof params.imageKey === 'string' ? IMAGE_KEY_MAP[params.imageKey] : undefined;
    const imageFromUri = typeof params.imageUri === 'string' && params.imageUri.length > 0 ? { uri: params.imageUri } : undefined;
    return {
      id: Number.isNaN(Number(id)) ? Date.now() : Number(id),
      title,
      description: typeof params.description === 'string' ? params.description : 'Service details',
      price: typeof params.price === 'string' ? params.price : '₹0',
      time: typeof params.time === 'string' ? params.time : 'Flexible',
      category: typeof params.category === 'string' ? params.category : 'Services',
      rating: typeof params.rating === 'string' ? formatRating(params.rating) : '—',
      image: imageFromUri ?? imageFromKey ?? IMAGE_MAP[title] ?? require('../../assets/images/servicebanner.png'),
    };
  }, [params, id]);

  const chosenProduct: Product | undefined = useMemo(() => {
    // Prefer params-derived product when provided to avoid collisions with predefined IDs
    return derivedProduct ?? product;
  }, [derivedProduct, product]);

  // Structured automobile details based on title
  const structuredDetails = useMemo(() => {
    const titleNorm = (chosenProduct?.title || '').toLowerCase();
    const categoryNorm = (chosenProduct?.category || '').toLowerCase();
    const details: { purpose?: string; uses?: string[]; benefits?: string[]; who?: string[]; how?: string[] } = {};

    // Explicit content for specific Recommended services
    if (titleNorm === 'car repair') {
      details.purpose = 'Car Repair Service — Complete repair and maintenance service for all types of cars.';
      details.uses = [
        'Engine diagnostics',
        'Brake repair',
        'Oil change',
        'Suspension check',
        'Electrical fixes',
      ];
      details.benefits = [
        'Keeps your vehicle safe and efficient',
        'Maintains top running condition',
      ];
      details.how = [
        'Vehicle inspected using advanced tools',
        'Faults identified',
        'Parts repaired or replaced by professionals',
      ];
      details.who = [
        'Car owners noticing noise, vibration, oil leakage, or dashboard warning lights',
      ];
      return details;
    }

    if (titleNorm === 'ac service') {
      details.purpose = 'Complete air conditioner servicing for homes and offices.';
      details.uses = [
        'Filter cleaning',
        'Gas refilling',
        'Coil washing',
        'Drain cleaning',
        'Cooling check',
      ];
      details.benefits = [
        'Improves cooling performance',
        'Saves electricity',
        'Increases AC lifespan',
      ];
      details.how = [
        'Indoor and outdoor units cleaned using jet pump',
        'Cooling gas checked and topped up if required',
      ];
      details.who = [
        'Homeowners or offices with AC showing low cooling or dust buildup',
      ];
      return details;
    }

    if (titleNorm === 'plumbing') {
      details.purpose = 'Professional plumbing solutions for all residential and commercial needs.';
      details.uses = [
        'Tap & pipe leak repair',
        'Drain cleaning',
        'Bathroom fittings',
        'Water line installation',
        'Routine maintenance',
      ];
      details.benefits = [
        'Prevents water wastage and damage',
        'Ensures smooth water flow',
      ];
      details.how = [
        'Skilled plumbers inspect the issue',
        'Replace faulty parts',
        'Test for leak-free operation',
      ];
      details.who = [
        'Households or offices facing leakage, low water flow, or fitting damage',
      ];
      return details;
    }

    // Bike Oil Change (category/title based)
    if ((categoryNorm.includes('bike general maintenance') || categoryNorm.includes('bike general maintenance & repairs')) && (titleNorm.includes('oil') && titleNorm.includes('change'))) {
      details.purpose = 'Replacement of old engine oil to maintain bike performance.';
      details.uses = ['Draining old oil', 'Refilling with fresh manufacturer-recommended oil', 'Filter cleaning'];
      details.benefits = ['Protects engine from wear', 'Improves mileage', 'Ensures smooth running'];
      details.how = ['Old oil drained completely', 'Filter cleaned/replaced', 'Fresh oil filled to proper level'];
      details.who = ['Every rider after 2500–3000 km or as per manufacturer’s service schedule.'];
    } else if (titleNorm.includes('oil') && titleNorm.includes('filter')) {
      details.purpose = 'To keep the engine lubricated and running smoothly.';
      details.uses = ['Replaces old oil and filters that collect dirt and carbon.'];
      details.benefits = ['Improves engine performance', 'Enhances fuel efficiency', 'Extends engine life'];
      details.who = ['Every car owner (recommended every 5,000–10,000 km)'];
      details.how = ['Book service', 'Mechanic drains old oil', 'Replaces filter', 'Adds fresh oil'];
    }

    // Brake Inspection & Replacement (handle common misspelling "Break" and category)
    if (titleNorm.includes('brake') || titleNorm.includes('break') || categoryNorm.includes('car general maintenance')) {
      details.purpose = 'To ensure safe braking and avoid accidents.';
      details.uses = ['Checks brake pads, discs, and fluid levels.'];
      details.benefits = [
        'Enhances road safety',
        'Reduces stopping distance',
        'Prevents wear on other parts',
      ];
      details.who = ['All car owners (especially if brakes feel weak or noisy).'];
      details.how = ['Service center checks', 'Replaces worn-out parts'];
    }

    if (titleNorm.includes('battery')) {
      details.purpose = 'To ensure smooth starting and electrical performance.';
      details.uses = ['Tests battery voltage, charging system, and replaces faulty batteries.'];
      details.benefits = ['Prevents sudden breakdowns', 'Ensures reliable performance'];
      details.who = ['Cars older than 2–3 years or with slow engine starts.'];
      details.how = ['Battery tested with diagnostic tools', 'Replaced if weak/damaged'];
    }

    if (titleNorm.includes('ac') || titleNorm.includes('a/c') || categoryNorm.includes('ac service')) {
      if (titleNorm.includes('service')) {
        details.purpose = 'To maintain effective cooling and comfort inside the car.';
        details.uses = ['Includes gas refill', 'Compressor check', 'Filter cleaning/replacement'];
        details.benefits = [
          'Improves cooling',
          'Enhances air quality',
          'Prevents major AC failures',
        ];
        details.who = ['Car owners facing weak cooling, foul smell, or noisy AC.'];
        details.how = ['Mechanic inspects', 'Cleans and services AC system'];
      }
    }

    // Heating System Service (cars)
    if (titleNorm.includes('heating') && (titleNorm.includes('service') || titleNorm.includes('system') || categoryNorm.includes('heating'))) {
      details.purpose = 'To maintain proper heating inside the vehicle for comfort and defogging.';
      details.uses = ['Checks heater core', 'Thermostat', 'Coolant', 'Blower motor'];
      details.benefits = [
        'Ensures warm cabin in winter',
        'Prevents windshield fogging',
        'Improves coolant circulation',
      ];
      details.who = ['Car owners facing poor heating, foggy windshield, or coolant issues.'];
      details.how = ['Mechanic inspects system', 'Flushes coolant if needed', 'Repairs/replaces faulty parts'];
    }

    // Alternator & Starter Motor Repair (cars)
    if ((titleNorm.includes('alternator') || titleNorm.includes('starter')) && (titleNorm.includes('repair') || titleNorm.includes('service'))) {
      details.purpose = 'To ensure proper charging of battery and smooth engine start.';
      details.uses = ['Diagnoses alternator charging capacity', 'Checks starter motor function'];
      details.benefits = ['Prevents breakdowns', 'Ensures reliable starting', 'Improves electrical performance'];
      details.who = ['Vehicles with dim lights, dead battery, or starting problems.'];
      details.how = ['Alternator/starter tested with diagnostic tools', 'Faulty components repaired or replaced'];
    }

    // Car Wiring & Electrical Issue Fix
    if ((titleNorm.includes('car') || titleNorm.includes('vehicle')) && (titleNorm.includes('wiring') || titleNorm.includes('electrical'))) {
      details.purpose = 'To repair and maintain the vehicle’s electrical system.';
      details.uses = ['Fixes issues with lights', 'Power windows', 'Dashboard electronics', 'Wiring'];
      details.benefits = ['Enhances safety', 'Restores smooth function of electronic components'];
      details.who = ['Vehicles with flickering lights, blown fuses, or malfunctioning electronics.'];
      details.how = ['Mechanic inspects circuits', 'Repairs/replaces faulty wiring or fuses'];
    }

    // Engine Diagnostics & Repair (cars)
    if ((titleNorm.includes('engine') && (titleNorm.includes('diagnostic') || titleNorm.includes('diagnostics') || titleNorm.includes('repair'))) &&
        !(titleNorm.includes('bike') || titleNorm.includes('motorcycle'))) {
      details.purpose = 'To detect and fix engine performance issues.';
      details.uses = ['ECU scanning', 'Compression testing', 'Fixing mechanical/electronic faults'];
      details.benefits = ['Improves mileage', 'Restores power', 'Reduces engine noise/smoke'];
      details.who = ['Vehicles with warning lights, power loss, unusual vibrations, or fuel inefficiency.'];
      details.how = ['Diagnostic tools used', 'Faulty parts repaired, cleaned, or replaced'];
    }

    // Transmission Repair/Replacement (cars) - also covered by generic gearbox/transmission block below
    if ((titleNorm.includes('transmission') || titleNorm.includes('gearbox')) && (titleNorm.includes('repair') || titleNorm.includes('replacement'))) {
      details.purpose = details.purpose || 'To restore smooth gear shifting and power delivery.';
      details.uses = details.uses || ['Inspects and repairs gearbox', 'Clutch system check', 'Transmission fluid service'];
      details.benefits = details.benefits || ['Prevents breakdowns', 'Ensures smoother drive', 'Increases vehicle lifespan'];
      details.who = details.who || ['Vehicles with hard gear shifts, slipping gears, burning smell, or fluid leaks.'];
      details.how = details.how || ['Gearbox/transmission dismantled', 'Faulty parts repaired or replaced', 'Fluid refilled'];
    }

    if (titleNorm.includes('suspension') || titleNorm.includes('steering')) {
      details.purpose = 'To maintain smooth handling and comfort while driving.';
      details.uses = ['Inspects shocks, struts, steering rack, and alignment.'];
      details.benefits = ['Improves ride comfort', 'Enhances stability', 'Extends tire life'];
      details.who = details.who || ['Cars with bumpy rides, poor handling, or uneven tire wear.'];
      details.how = ['Suspension & steering parts repaired/replaced at workshop'];
    }

    // Bike Engine & Electronic Services
    if ((titleNorm.includes('bike') || titleNorm.includes('motorcycle')) &&
        (titleNorm.includes('wiring') || titleNorm.includes('electrical'))) {
      details.purpose = 'To repair faulty wiring and electrical components.';
      details.uses = ['Fixes issues with lights, horn, indicators, and wiring.'];
      details.benefits = ['Ensures safety', 'Improves reliability', 'Smooth functioning of electronics'];
      details.who = ['Bikes with dim lights, dead horn, or wiring faults.'];
      details.how = ['Mechanic inspects wiring', 'Repairs/rewires if required'];
    }

    if ((titleNorm.includes('engine') && (titleNorm.includes('diagnostic') || titleNorm.includes('repair'))) &&
        (titleNorm.includes('bike') || titleNorm.includes('motorcycle'))) {
      details.purpose = 'To check and restore bike engine health.';
      details.uses = ['Involves tuning', 'Compression tests', 'Fixing mechanical faults'];
      details.benefits = ['Improves pickup', 'Better mileage', 'Reduces smoke/noise'];
      details.who = ['Bikes with power loss, poor mileage, or unusual noise.'];
      details.how = ['Diagnosis with tools', 'Faulty parts repaired or replaced'];
    }

    if ((titleNorm.includes('gearbox') || titleNorm.includes('transmission')) &&
        (titleNorm.includes('repair') || titleNorm.includes('replacement'))) {
      details.purpose = 'To fix transmission issues for smooth gear shifting.';
      details.uses = ['Inspects and repairs gears', 'Checks clutch', 'Replaces transmission oil'];
      details.benefits = ['Ensures smooth rides', 'Prevents breakdowns'];
      details.who = ['Bikes with hard gear shifts, slipping gears, or noise.'];
      details.how = ['Gearbox disassembled', 'Worn parts repaired/replaced'];
    }

    if (titleNorm.includes('headlight') || titleNorm.includes('indicator')) {
      details.purpose = 'To maintain safe night and signal visibility.';
      details.uses = ['Checks bulbs', 'Switches', 'Wiring'];
      details.benefits = ['Improves visibility', 'Ensures road safety'];
      details.who = ['Bikes with dim/faulty lights or non-working indicators.'];
      details.how = ['Replace bulbs', 'Wiring check', 'Switch repair'];
    }

    if (titleNorm.includes('spark plug')) {
      details.purpose = 'To ensure proper ignition in the engine.';
      details.uses = ['Replaces old/faulty spark plugs.'];
      details.benefits = ['Better mileage', 'Smooth start', 'Improved pickup'];
      details.who = ['Bikes with poor starting, misfires, or low mileage.'];
      details.how = ['Old spark plug removed', 'Replaced with new one'];
    }

    if (titleNorm.includes('starter motor') || (titleNorm.includes('starter') && titleNorm.includes('repair'))) {
      details.purpose = 'To fix starting issues in bikes.';
      details.uses = ['Repairs/replaces starter motor', 'Relay', 'Electrical connections'];
      details.benefits = ['Ensures reliable starting', 'Prevents breakdowns'];
      details.who = ['Bikes with self-start issues or clicking sound.'];
      details.how = ['Starter motor inspected, cleaned, and repaired/replaced'];
    }

    // Car Body & Paint Work
    if (titleNorm.includes('bumper') && titleNorm.includes('repair')) {
      details.purpose = 'Fixes damaged or cracked bumpers to restore safety and appearance.'; // Description
      details.uses = ['Plastic welding', 'Alignment', 'Repainting if required']; // Includes
      details.benefits = ['Ensures safety', 'Improves looks', 'Prevents further damage']; // Why Needed
      details.how = ['Skilled technicians repair or replace bumpers with OEM parts']; // How It’s Done
    }

    if (titleNorm.includes('dent') && (titleNorm.includes('removal') || titleNorm.includes('repair'))) {
      details.purpose = 'Removes dents and dings from the car body without affecting the paint (PDR – Paintless Dent Removal).';
      details.uses = ['Minor dents', 'Dings', 'Hail damage', 'Body reshaping'];
      details.benefits = ['Restores car’s original look', 'Improves resale value'];
      details.how = ['Special tools are used to massage dents back to normal shape'];
    }

    if ((titleNorm.includes('scratch') && (titleNorm.includes('repair') || titleNorm.includes('painting'))) ||
        titleNorm.includes('scratch repair & painting')) {
      details.purpose = 'Repairs scratches and restores original car paint finish.';
      details.uses = ['Surface scratch removal', 'Deep scratch filling', 'Repainting & polishing'];
      details.benefits = ['Protects metal body from rust', 'Improves aesthetics'];
      details.how = ['Sanding', 'Filling', 'Priming', 'Color matching', 'Painting', 'Polishing'];
    }

    if ((titleNorm.includes('windshield') || titleNorm.includes('glass')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || categoryNorm.includes('glass'))) {
      details.purpose = 'Replacement or repair of cracked, chipped, or broken car glass.';
      details.uses = ['Front windshield', 'Rear glass', 'Side windows'];
      details.benefits = ['Ensures driver visibility', 'Improves safety', 'Prevents accidents'];
      details.how = ['Old glass removed', 'Adhesive applied', 'New glass fitted with precision'];
    }

    // Bike Detailing & Cleaning
    if ((titleNorm.includes('bike') || titleNorm.includes('motorcycle') || categoryNorm.includes('bike detailing')) && titleNorm.includes('wash')) {
      if (titleNorm.includes('chain') || titleNorm.includes('exterior')) {
        details.purpose = 'Complete bike wash with focus on body and chain cleaning.';
        details.uses = ['High-pressure wash', 'Shampoo cleaning', 'Chain degreasing & lubrication'];
        details.benefits = ['Removes dirt, dust, grease', 'Improves bike performance'];
        details.how = ['Bike washed using water jet', 'Chain cleaned with degreaser', 'Chain lubricated'];
        details.who = ['Riders who travel regularly on dusty or rainy roads.'];
      }
    }

    if ((titleNorm.includes('deep') || titleNorm.includes('interior')) && titleNorm.includes('clean') && (titleNorm.includes('bike') || titleNorm.includes('seat') || categoryNorm.includes('bike detailing'))) {
      details.purpose = 'Detailed cleaning of bike seat, footrest, and under-seat area.';
      details.uses = ['Foam cleaning', 'Stain removal', 'Deodorizing treatment'];
      details.benefits = ['Keeps seating hygienic', 'Removes sweat odor', 'Prevents wear'];
      details.how = ['Seats removed', 'Cleaned with foam & vacuum', 'Dried and polished'];
      details.who = ['Riders using bikes daily or on long rides.'];
    }

    if ((titleNorm.includes('polish') || titleNorm.includes('wax')) && (titleNorm.includes('bike') || titleNorm.includes('motorcycle') || categoryNorm.includes('bike detailing'))) {
      details.purpose = 'Enhances bike’s shine and protects paint from dust & rust.';
      details.uses = ['Paint polish', 'Wax coating', 'Plastic & metal part shining'];
      details.benefits = ['Protects from UV rays and rust', 'Gives a new-like look'];
      details.how = ['Bike surface cleaned', 'Polished with compounds', 'Wax applied'];
      details.who = ['Riders who want their bike to look showroom-fresh.'];
    }

    // Car Detailing & Cleaning
    if (titleNorm.includes('car wash') || titleNorm.includes('wash') && categoryNorm.includes('car detailing')) {
      details.purpose = 'Professional cleaning of both car exterior and cabin interior.';
      details.uses = ['Exterior shampoo wash', 'Interior vacuuming', 'Dashboard polish', 'Mat cleaning'];
      details.benefits = ['Removes dirt', 'Ensures hygiene', 'Maintains car’s appeal'];
      details.how = ['Exterior foam wash', 'Interior vacuum & polish'];
      details.who = ['Car owners driving daily in city traffic or dusty environments.'];
    }

    if ((titleNorm.includes('ceramic') && titleNorm.includes('coating')) || categoryNorm.includes('car detailing') && titleNorm.includes('ceramic')) {
      details.purpose = 'Long-lasting ceramic protection layer for car paint.';
      details.uses = ['Paint correction', 'Ceramic liquid application', 'Curing under UV'];
      details.benefits = ['Protects from scratches, UV rays, dust, and water spots'];
      details.how = ['Car polished', 'Ceramic coating applied', 'Cured with heat/UV'];
      details.who = ['Car owners who want premium protection & glossy finish.'];
    }

    if ((titleNorm.includes('deep') || titleNorm.includes('interior')) && titleNorm.includes('clean') && (titleNorm.includes('car') || categoryNorm.includes('car detailing'))) {
      details.purpose = 'Intensive cleaning of all interior surfaces including seats & roof.';
      details.uses = ['Carpet shampoo', 'Seat cleaning', 'Roof lining wash', 'Odor removal'];
      details.benefits = ['Ensures hygiene', 'Removes stains', 'Keeps car fresh'];
      details.how = ['Vacuuming', 'Foam wash', 'Steam cleaning', 'Deodorizing'];
      details.who = ['Families with kids/pets or cars used for long travel.'];
    }

    if ((titleNorm.includes('polish') || titleNorm.includes('wax')) && (titleNorm.includes('car') || categoryNorm.includes('car detailing'))) {
      details.purpose = 'Restores shine & protects car paint from dust and scratches.';
      details.uses = ['Exterior polish', 'Wax layer', 'Plastic & chrome part shining'];
      details.benefits = ['Maintains resale value', 'Prevents fading & dullness'];
      details.how = ['Car surface polished with compounds', 'Finished with wax coat'];
      details.who = ['Car owners looking for a glossy, new look before events or resale.'];
    }

    // Chimney Repair & Services
    const chimneyKeyword =
      titleNorm.includes('circuit board') ||
      (titleNorm.includes('deep') && titleNorm.includes('clean') && (titleNorm.includes('filter') || titleNorm.includes('mesh'))) ||
      (titleNorm.includes('duct') && (titleNorm.includes('pipe') || titleNorm.includes('piping'))) ||
      (titleNorm.includes('exhaust') && titleNorm.includes('fan')) ||
      (titleNorm.includes('fan') && titleNorm.includes('blade')) ||
      (titleNorm.includes('oil') && titleNorm.includes('collector')) ||
      titleNorm.includes('motor') ||
      (titleNorm.includes('noise') && (titleNorm.includes('reduction') || titleNorm.includes('service') || titleNorm.includes('fix')));
    const inChimneyCategory = categoryNorm.includes('chimney') || (categoryNorm.includes('kitchen appliances') && chimneyKeyword);
    if (inChimneyCategory || titleNorm.includes('chimney') || chimneyKeyword) {
      if (titleNorm.includes('circuit') && titleNorm.includes('board')) {
        details.purpose = 'Repair or replacement of malfunctioning circuit boards in chimneys.';
        details.benefits = ['Ensures proper control of fan, lights, and sensors'];
        details.how = ['Technicians diagnose electrical faults', 'Repair or replace the board'];
        details.who = ['Customers facing unresponsive buttons, erratic operation, or error codes.'];
      }
      if ((titleNorm.includes('deep') && titleNorm.includes('clean')) && (titleNorm.includes('filter') || titleNorm.includes('mesh'))) {
        details.purpose = 'Thorough cleaning of chimney filters and mesh.';
        details.benefits = ['Removes grease and smoke residue', 'Ensures optimal suction'];
        details.how = ['Filters/mesh removed', 'Soaked', 'Cleaned', 'Reinstalled'];
        details.who = ['Periodic maintenance or when suction decreases.'];
      }
      if (titleNorm.includes('duct') && (titleNorm.includes('pipe') || titleNorm.includes('piping'))) {
        details.purpose = 'Cleaning or replacing duct pipes connected to chimneys.';
        details.benefits = ['Prevents smoke buildup and blockages', 'Improves airflow'];
        details.how = ['Pipes inspected', 'Cleaned or replaced if damaged'];
        details.who = ['Homes with poor ventilation or clogged ducts.'];
      }
      if (titleNorm.includes('exhaust') && titleNorm.includes('fan') && (titleNorm.includes('lubric') || titleNorm.includes('servic'))) {
        details.purpose = 'Maintenance of the chimney exhaust fan for smooth operation.';
        details.benefits = ['Reduces friction and noise', 'Extends fan life'];
        details.how = ['Fan dismantled', 'Lubricated', 'Tested', 'Reassembled'];
        details.who = ['Customers noticing noisy or slow fans.'];
      }
      if ((titleNorm.includes('fan') && titleNorm.includes('blade')) && (titleNorm.includes('clean') || titleNorm.includes('balanc'))) {
        details.purpose = 'Cleaning and balancing of chimney fan blades.';
        details.benefits = ['Ensures even airflow', 'Reduces vibrations', 'Prolongs motor life'];
        details.how = ['Blades cleaned', 'Balanced', 'Reinstalled'];
        details.who = ['Customers experiencing vibrations or uneven suction.'];
      }
      if (titleNorm.includes('motor') && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of faulty chimney motors.';
        details.benefits = ['Restores proper suction and exhaust performance'];
        details.how = ['Faulty motors tested', 'Repaired or replaced with compatible parts'];
        details.who = ['Chimneys not drawing smoke properly or motor not starting.'];
      }
      if (titleNorm.includes('noise') && (titleNorm.includes('reduction') || titleNorm.includes('service') || titleNorm.includes('fix'))) {
        details.purpose = 'Reducing abnormal noise from chimneys.';
        details.benefits = ['Ensures quieter operation'];
        details.how = ['Components inspected', 'Fan blades balanced', 'Motor lubricated', 'Vibrations minimized'];
        details.who = ['Customers with loud or rattling chimneys.'];
      }
      if ((titleNorm.includes('oil') && titleNorm.includes('collector')) && (titleNorm.includes('clean') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Cleaning or replacing the oil collector tray.';
        details.benefits = ['Prevents oil spillage', 'Maintains hygiene', 'Improves suction'];
        details.how = ['Oil collector removed', 'Cleaned or replaced as needed'];
        details.who = ['When oil overflow or collection issues occur.'];
      }
    }

    // Dishwasher Repair & Services
    const dishwasherKeyword =
      titleNorm.includes('dishwasher') ||
      (titleNorm.includes('detergent') && titleNorm.includes('dispenser')) ||
      (titleNorm.includes('door') && (titleNorm.includes('latch') || titleNorm.includes('gasket'))) ||
      (titleNorm.includes('heating') && titleNorm.includes('element')) ||
      ((titleNorm.includes('motor') || titleNorm.includes('pump')) && (titleNorm.includes('repair') || titleNorm.includes('replace'))) ||
      titleNorm.includes('not cleaning') || titleNorm.includes('poor cleaning') || titleNorm.includes('not clean') ||
      (titleNorm.includes('deep cleaning') && titleNorm.includes('descaling')) || (titleNorm.includes('deep') && titleNorm.includes('clean') && titleNorm.includes('descal')) ||
      titleNorm.includes('spray arm') ||
      (titleNorm.includes('water') && (titleNorm.includes('not drain') || titleNorm.includes('not draining') || titleNorm.includes('drain issue') || titleNorm.includes('drain problem'))) ||
      (titleNorm.includes('drain') && (titleNorm.includes('issue') || titleNorm.includes('repair')));
    const inDishwasherCategory = categoryNorm.includes('dishwasher') || (categoryNorm.includes('kitchen appliances') && dishwasherKeyword);
    if (inDishwasherCategory || dishwasherKeyword) {
      if (titleNorm.includes('detergent') && titleNorm.includes('dispenser')) {
        details.purpose = 'Repair or replacement of detergent dispenser.';
        details.benefits = ['Ensures proper detergent release for effective cleaning'];
        details.how = ['Dispenser inspected', 'Repaired or replaced'];
        details.who = ['Detergent not dispensing during wash cycles.'];
      }
      if ((titleNorm.includes('door') && (titleNorm.includes('latch') || titleNorm.includes('gasket')))) {
        details.purpose = 'Repair or replacement of door latch and sealing gasket.';
        details.benefits = ['Prevents leaks', 'Ensures proper door closure'];
        details.how = ['Door components replaced and tested'];
        details.who = ['Leaks, door not locking properly, or gasket damage.'];
      }
      if (titleNorm.includes('heating') && titleNorm.includes('element')) {
        details.purpose = 'Fixing heating elements responsible for drying dishes.';
        details.benefits = ['Ensures dishes dry properly after wash'];
        details.how = ['Faulty element diagnosed', 'Repaired or replaced'];
        details.who = ['Wet dishes after cycle completion.'];
      }
      if ((titleNorm.includes('motor') || titleNorm.includes('pump')) && (titleNorm.includes('repair') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of motor or pump.';
        details.benefits = ['Ensures proper water circulation and wash performance'];
        details.how = ['Motor/pump tested', 'Repaired or replaced'];
        details.who = ['Water not circulating or wash cycles failing.'];
      }
      if (titleNorm.includes('not cleaning') || titleNorm.includes('poor cleaning') || titleNorm.includes('not clean')) {
        details.purpose = 'Identifying and fixing issues causing poor cleaning.';
        details.benefits = ['Ensures dishes come out spotless'];
        details.how = ['Spray arms, filters, and water flow checked', 'Faults repaired'];
        details.who = ['Dishes remain dirty after washing.'];
      }
      if ((titleNorm.includes('deep cleaning') && titleNorm.includes('descaling')) || (titleNorm.includes('deep') && titleNorm.includes('clean') && titleNorm.includes('descal'))) {
        details.purpose = 'Periodic cleaning of dishwasher interiors to remove lime, grease, and residues.';
        details.benefits = ['Maintains hygiene', 'Improves performance', 'Extends lifespan'];
        details.how = ['Cleaning agents applied', 'Filters and interiors scrubbed', 'Descaling performed'];
        details.who = ['Recommended every 3–6 months or when odors appear.'];
      }
      if (titleNorm.includes('spray arm')) {
        details.purpose = 'Cleaning and repairing dishwasher spray arms.';
        details.benefits = ['Ensures even water distribution for effective cleaning'];
        details.how = ['Spray arms removed', 'Cleaned', 'Repaired or replaced'];
        details.who = ['Poor cleaning due to blocked or damaged spray arms.'];
      }
      if ((titleNorm.includes('water') && (titleNorm.includes('not drain') || titleNorm.includes('not draining') || titleNorm.includes('drain issue') || titleNorm.includes('drain problem'))) || (titleNorm.includes('drain') && (titleNorm.includes('issue') || titleNorm.includes('repair')))) {
        details.purpose = 'Fixing drainage issues.';
        details.benefits = ['Prevents water accumulation and cycle failures'];
        details.how = ['Drain filters, pump, and hoses checked and repaired or cleared'];
        details.who = ['Water remains in dishwasher after wash cycle.'];
      }
    }

    // Microwave Repair Services
    const microwaveKeyword = titleNorm.includes('microwave');
    const microwaveSpecificHit =
      (titleNorm.includes('clean') && titleNorm.includes('deodor')) ||
      (titleNorm.includes('door') && titleNorm.includes('switch')) ||
      (titleNorm.includes('fuse') || titleNorm.includes('wiring')) ||
      (titleNorm.includes('heating') && (titleNorm.includes('not') || titleNorm.includes('uneven'))) ||
      (titleNorm.includes('interior') && titleNorm.includes('light')) ||
      titleNorm.includes('magnetron') ||
      (titleNorm.includes('touchpad') || titleNorm.includes('button') || titleNorm.includes('display')) ||
      (titleNorm.includes('turntable') && (titleNorm.includes('motor') || titleNorm.includes('rotate')));
    const inMicrowaveCategory = categoryNorm.includes('microwave') || (categoryNorm.includes('home appliances') && (microwaveKeyword || microwaveSpecificHit));
    if (inMicrowaveCategory || microwaveKeyword || microwaveSpecificHit) {
      if (titleNorm.includes('clean') && titleNorm.includes('deodor')) {
        details.purpose = 'Thorough cleaning and deodorizing of microwave interiors and exteriors.';
        details.benefits = ['Removes food residues', 'Eliminates odors', 'Maintains hygiene'];
        details.how = ['Microwave cleaned using safe agents', 'Vents and trays sanitized'];
        details.who = ['Periodic maintenance or when odors persist.'];
      }
      if (titleNorm.includes('door') && titleNorm.includes('switch')) {
        details.purpose = 'Repair or replacement of faulty door switches.';
        details.benefits = ['Ensures operation only when door is securely closed'];
        details.how = ['Switch tested', 'Repaired or replaced for proper operation'];
        details.who = ['Microwave not starting or stopping unexpectedly.'];
      }
      if (titleNorm.includes('fuse') || titleNorm.includes('wiring')) {
        details.purpose = 'Repair of blown fuses or damaged wiring.';
        details.benefits = ['Ensures safe and uninterrupted microwave operation'];
        details.how = ['Faulty fuses/wires identified and replaced', 'Unit tested for safety'];
        details.who = ['Microwave not powering on or tripping electrical circuits.'];
      }
      if (titleNorm.includes('heating') && (titleNorm.includes('not') || titleNorm.includes('uneven'))) {
        details.purpose = 'Fixing microwave heating problems.';
        details.benefits = ['Ensures food cooks evenly and efficiently'];
        details.how = ['Magnetron, power supply, and circuits checked and repaired'];
        details.who = ['Microwave not heating or heating unevenly.'];
      }
      if (titleNorm.includes('interior') && titleNorm.includes('light')) {
        details.purpose = 'Replacement of burnt-out interior lights.';
        details.benefits = ['Provides clear visibility inside the microwave'];
        details.how = ['Light assembly replaced and tested'];
        details.who = ['Dim or non-functional interior light.'];
      }
      if (titleNorm.includes('magnetron')) {
        details.purpose = 'Replacement of the microwave’s magnetron.';
        details.benefits = ['Restores proper heating functionality'];
        details.how = ['Faulty magnetron removed', 'New one installed', 'Tested for heating'];
        details.who = ['Microwave failing to heat after basic troubleshooting.'];
      }
      if (titleNorm.includes('touchpad') || titleNorm.includes('button') || titleNorm.includes('display')) {
        details.purpose = 'Repair or replacement of control touchpads, buttons, or displays.';
        details.benefits = ['Ensures proper operation and usability of microwave functions'];
        details.how = ['Panel tested', 'Repaired, or replaced'];
        details.who = ['Non-responsive buttons or faulty displays.'];
      }
      if (titleNorm.includes('turntable') && (titleNorm.includes('motor') || titleNorm.includes('rotate'))) {
        details.purpose = 'Fixing or replacing the turntable motor.';
        details.benefits = ['Ensures even cooking by rotating food properly'];
        details.how = ['Turntable motor inspected', 'Repaired or replaced'];
        details.who = ['Food not rotating or cooking unevenly.'];
      }
    }

    // Refrigerator Repair Services
    const refrigeratorKeyword = titleNorm.includes('refrigerator') || titleNorm.includes('fridge') || titleNorm.includes('freezer');
    const refrigeratorSpecificHit =
      (titleNorm.includes('cooling') && (titleNorm.includes('not') || titleNorm.includes('over'))) ||
      (titleNorm.includes('door') && titleNorm.includes('gasket')) ||
      (titleNorm.includes('gas') && titleNorm.includes('refill')) || titleNorm.includes('compressor') ||
      titleNorm.includes('ice maker') ||
      (titleNorm.includes('noisy') || titleNorm.includes('noise')) ||
      (titleNorm.includes('pcb') || titleNorm.includes('control board')) ||
      (titleNorm.includes('regular') && (titleNorm.includes('clean') || titleNorm.includes('maintenance'))) ||
      titleNorm.includes('thermostat') ||
      (titleNorm.includes('water') && titleNorm.includes('leak'));
    const inRefrigeratorCategory = categoryNorm.includes('refrigerator') || categoryNorm.includes('fridge') || (categoryNorm.includes('home appliances') && (refrigeratorKeyword || refrigeratorSpecificHit));
    if (inRefrigeratorCategory || refrigeratorKeyword || refrigeratorSpecificHit) {
      if (titleNorm.includes('cooling') && (titleNorm.includes('not') || titleNorm.includes('over'))) {
        details.purpose = 'Troubleshooting cooling problems in refrigerators.';
        details.benefits = ['Maintains proper food preservation and storage'];
        details.how = ['Compressor, refrigerant, and circuits checked and repaired'];
        details.who = ['Food spoiling quickly or freezer too cold.'];
      }
      if (titleNorm.includes('door') && titleNorm.includes('gasket')) {
        details.purpose = 'Replacement of faulty door gaskets.';
        details.benefits = ['Ensures airtight seal', 'Improves efficiency', 'Prevents energy loss'];
        details.how = ['Damaged gaskets replaced', 'Doors checked for proper sealing'];
        details.who = ['Leaks, frost buildup, or cooling inefficiency.'];
      }
      if ((titleNorm.includes('gas') && titleNorm.includes('refill')) || titleNorm.includes('compressor')) {
        details.purpose = 'Refilling refrigerant gas or repairing the compressor.';
        details.benefits = ['Restores proper cooling', 'Improves compressor efficiency'];
        details.how = ['Gas levels checked/refilled', 'Compressor repaired or replaced'];
        details.who = ['Refrigerator not cooling or making unusual noises.'];
      }
      if (titleNorm.includes('ice maker')) {
        details.purpose = 'Fixing ice maker malfunctions.';
        details.benefits = ['Ensures consistent ice production'];
        details.how = ['Ice maker components inspected', 'Repaired or replaced'];
        details.who = ['Ice production stopped or inconsistent.'];
      }
      if (titleNorm.includes('noisy') || titleNorm.includes('noise')) {
        details.purpose = 'Reducing unusual refrigerator noise.';
        details.benefits = ['Ensures quiet operation', 'Prevents motor damage'];
        details.how = ['Fans, compressor, and internal components inspected and adjusted'];
        details.who = ['Loud humming, rattling, or vibrating refrigerators.'];
      }
      if (titleNorm.includes('pcb') || titleNorm.includes('control board')) {
        details.purpose = 'Repair or replacement of the refrigerator’s control board.';
        details.benefits = ['Restores proper operation of temperature and functions'];
        details.how = ['PCB tested', 'Repaired, or replaced', 'Settings verified'];
        details.who = ['Unresponsive controls or inconsistent cooling.'];
      }
      if (titleNorm.includes('regular') && (titleNorm.includes('clean') || titleNorm.includes('maintenance'))) {
        details.purpose = 'Preventive servicing to maintain efficiency.';
        details.benefits = ['Extends lifespan', 'Prevents future breakdowns'];
        details.how = ['Condenser coils, filters, and interiors cleaned', 'System checked'];
        details.who = ['Periodic maintenance or before summer months.'];
      }
      if (titleNorm.includes('thermostat')) {
        details.purpose = 'Replacement of faulty thermostats.';
        details.benefits = ['Maintains correct temperature control'];
        details.how = ['Thermostat tested', 'Replaced', 'Cooling verified'];
        details.who = ['Temperature irregularities or over/under-cooling.'];
      }
      if (titleNorm.includes('water') && titleNorm.includes('leak')) {
        details.purpose = 'Repairing leaks in refrigerator water systems or trays.';
        details.benefits = ['Prevents water damage', 'Maintains hygiene'];
        details.how = ['Water lines, trays, and seals inspected', 'Repaired or replaced'];
        details.who = ['Water dripping inside or outside the refrigerator.'];
      }
    }

    // Speaker Repair & Services
    const speakerKeyword = titleNorm.includes('speaker') || titleNorm.includes('soundbar') || titleNorm.includes('woofer') || titleNorm.includes('home theater');
    const speakerSpecificHit =
      titleNorm.includes('amplifier') ||
      titleNorm.includes('bluetooth') || titleNorm.includes('connectivity') ||
      titleNorm.includes('distorted') || titleNorm.includes('cracking') || titleNorm.includes('buzzing') ||
      (titleNorm.includes('home') && titleNorm.includes('theater') && (titleNorm.includes('installation') || titleNorm.includes('setup'))) ||
      (titleNorm.includes('no sound') || (titleNorm.includes('low') && titleNorm.includes('sound'))) ||
      (titleNorm.includes('regular') && (titleNorm.includes('clean') || titleNorm.includes('maintenance'))) ||
      titleNorm.includes('soundbar') || titleNorm.includes('woofer') ||
      ((titleNorm.includes('wiring') || titleNorm.includes('port')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace')));
    const inSpeakerCategory = categoryNorm.includes('speaker') || categoryNorm.includes('speaker repair & services') || (categoryNorm.includes('home electronics') && (speakerKeyword || speakerSpecificHit));
    if (inSpeakerCategory || speakerKeyword || speakerSpecificHit) {
      if (titleNorm.includes('amplifier')) {
        details.purpose = 'Repair of faulty speaker amplifiers.';
        details.benefits = ['Ensures proper sound output', 'Prevents distortion'];
        details.how = ['Amplifier circuits tested', 'Components repaired or replaced'];
        details.who = ['Speakers producing weak or no sound.'];
      }
      if (titleNorm.includes('bluetooth') || titleNorm.includes('connectivity')) {
        details.purpose = 'Troubleshooting wireless or wired connectivity problems.';
        details.benefits = ['Ensures seamless pairing and audio streaming'];
        details.how = ['Connectivity modules tested', 'Repaired, or reset'];
        details.who = ['Speakers not pairing or disconnecting frequently.'];
      }
      if (titleNorm.includes('distorted') || titleNorm.includes('cracking') || titleNorm.includes('buzzing')) {
        details.purpose = 'Repairing sound distortion, cracking, or buzzing.';
        details.benefits = ['Restores clear and high-quality audio'];
        details.how = ['Speaker drivers, amplifiers, and wiring inspected and repaired'];
        details.who = ['Distorted or inconsistent sound output.'];
      }
      if ((titleNorm.includes('home') && titleNorm.includes('theater')) && (titleNorm.includes('installation') || titleNorm.includes('setup'))) {
        details.purpose = 'Professional installation and configuration of home theater systems.';
        details.benefits = ['Ensures optimal sound experience', 'Reliable connectivity'];
        details.how = ['Speakers positioned', 'Wired', 'Connected to media devices', 'Tested'];
        details.who = ['New setups or home theater upgrades.'];
      }
      if (titleNorm.includes('no sound') || (titleNorm.includes('low') && titleNorm.includes('sound'))) {
        details.purpose = 'Fixing speakers producing no sound or very low volume.';
        details.benefits = ['Restores normal audio output'];
        details.how = ['Wiring, drivers, and circuits inspected and repaired'];
        details.who = ['Speakers producing inadequate or no audio.'];
      }
      if (titleNorm.includes('regular') && (titleNorm.includes('clean') || titleNorm.includes('maintenance'))) {
        details.purpose = 'Periodic cleaning of speaker grills, ports, and internal components.';
        details.benefits = ['Prevents dust accumulation', 'Maintains sound quality', 'Extends lifespan'];
        details.how = ['Speakers disassembled if needed', 'Cleaned', 'Tested'];
        details.who = ['Periodic preventive maintenance or when dust affects sound.'];
      }
      if (titleNorm.includes('soundbar') || titleNorm.includes('woofer')) {
        details.purpose = 'Repair of soundbars or subwoofers for home or media setups.';
        details.benefits = ['Restores proper bass and sound output'];
        details.how = ['Components tested', 'Drivers and circuits repaired or replaced'];
        details.who = ['Distorted, weak, or non-functional soundbars/woofers.'];
      }
      if ((titleNorm.includes('wiring') || titleNorm.includes('port')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Fixing faulty speaker wires, input/output ports, and connectors.';
        details.benefits = ['Ensures reliable connectivity', 'Uninterrupted sound'];
        details.how = ['Damaged wires or ports replaced', 'Connections tested'];
        details.who = ['Loose connections, broken ports, or intermittent sound.'];
      }
    }

    // Television Repair & Services
    const tvKeyword = titleNorm.includes('tv') || titleNorm.includes('television') || titleNorm.includes('smart tv');
    const tvSpecificHit =
      titleNorm.includes('display issues') || titleNorm.includes('no picture') || titleNorm.includes('lines') || titleNorm.includes('color') ||
      ((titleNorm.includes('installation') || titleNorm.includes('mounting') || titleNorm.includes('wall mounting')) && !titleNorm.includes('theater')) ||
      titleNorm.includes('no power') || titleNorm.includes('dead tv') ||
      titleNorm.includes('port') || titleNorm.includes('connectivity') || titleNorm.includes('hdmi') || titleNorm.includes('usb') || titleNorm.includes('wi-fi') || titleNorm.includes('wifi') ||
      titleNorm.includes('remote sensor') || titleNorm.includes('button') ||
      (titleNorm.includes('screen') && titleNorm.includes('replacement')) || titleNorm.includes('smart tv app') ||
      titleNorm.includes('sound problems') || titleNorm.includes('no audio') || titleNorm.includes('distorted sound') ||
      (titleNorm.includes('uninstallation') || titleNorm.includes('reinstallation'));
    const inTvCategory = categoryNorm.includes('tv') || categoryNorm.includes('television') || categoryNorm.includes('television repair & services') || (categoryNorm.includes('home electronics') && (tvKeyword || tvSpecificHit));
    if (inTvCategory || tvKeyword || tvSpecificHit) {
      if (titleNorm.includes('display issues') || titleNorm.includes('no picture') || titleNorm.includes('lines') || titleNorm.includes('color')) {
        details.purpose = 'Repairing TV screen problems including lines, blank screens, or color issues.';
        details.benefits = ['Restores proper image quality'];
        details.how = ['Display panels, T‑con boards, or internal circuits repaired/replaced'];
        details.who = ['TV showing visual defects or no picture.'];
      }
      if (((titleNorm.includes('installation') || titleNorm.includes('mounting') || titleNorm.includes('wall mounting')) && !titleNorm.includes('theater'))) {
        details.purpose = 'Professional setup and mounting of TVs.';
        details.benefits = ['Ensures safe mounting', 'Correct placement for optimal viewing'];
        details.how = ['Brackets installed', 'TV mounted', 'Cables managed', 'Setup tested'];
        details.who = ['New TV setups or relocations.'];
      }
      if (titleNorm.includes('no power') || titleNorm.includes('dead tv')) {
        details.purpose = 'Fixing TVs that won’t turn on or are completely dead.';
        details.benefits = ['Restores power and functionality'];
        details.how = ['Power boards, fuses, and internal circuits tested and repaired'];
        details.who = ['TV not powering on or intermittently turning off.'];
      }
      if (titleNorm.includes('port') || titleNorm.includes('connectivity') || titleNorm.includes('hdmi') || titleNorm.includes('usb') || titleNorm.includes('wi-fi') || titleNorm.includes('wifi')) {
        details.purpose = 'Repairing or troubleshooting HDMI, USB, or network connectivity issues.';
        details.benefits = ['Ensures uninterrupted input/output and internet access'];
        details.how = ['Ports tested, repaired, or replaced', 'Network modules checked'];
        details.who = ['Ports not working or Wi‑Fi/Bluetooth issues.'];
      }
      if (titleNorm.includes('remote sensor') || titleNorm.includes('button')) {
        details.purpose = 'Fixing unresponsive remote sensors or TV buttons.';
        details.benefits = ['Restores control over TV functions'];
        details.how = ['Sensors or buttons tested', 'Replaced if needed'];
        details.who = ['TV not responding to remote or physical buttons.'];
      }
      if ((titleNorm.includes('screen') && titleNorm.includes('replacement')) || titleNorm.includes('smart tv app')) {
        details.purpose = 'Replacement of damaged TV screens and fixing smart app issues.';
        details.benefits = ['Restores display functionality and app usability'];
        details.how = ['Faulty screens replaced', 'Apps updated or reinstalled'];
        details.who = ['Broken screens or non‑functional smart TV features.'];
      }
      if (titleNorm.includes('sound problems') || titleNorm.includes('no audio') || titleNorm.includes('distorted sound')) {
        details.purpose = 'Repairing TV audio issues including no sound or distortion.';
        details.benefits = ['Restores clear audio output'];
        details.how = ['Internal speakers, amplifiers, and circuits tested and repaired'];
        details.who = ['TV producing no sound or distorted audio.'];
      }
      if (titleNorm.includes('uninstallation') || titleNorm.includes('reinstallation')) {
        details.purpose = 'Safe removal and reinstallation of TVs.';
        details.benefits = ['Ensures proper handling during shifting or room changes'];
        details.how = ['TV carefully removed', 'Mounted/reinstalled securely', 'Cables reconnected'];
        details.who = ['Relocation or replacement of existing TVs.'];
      }
    }

    // Washing Machine Repair Services
    const wmKeyword = titleNorm.includes('washing machine') || titleNorm.includes('washer');
    const wmSpecificHit =
      (titleNorm.includes('deep') && titleNorm.includes('clean')) ||
      (titleNorm.includes('detergent') && titleNorm.includes('dispenser')) ||
      ((titleNorm.includes('door') && titleNorm.includes('lock')) || titleNorm.includes('gasket')) ||
      ((titleNorm.includes('motor') || titleNorm.includes('pump')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      titleNorm.includes('noise') || titleNorm.includes('vibration') ||
      (titleNorm.includes('not spinning') || (titleNorm.includes('drum') && (titleNorm.includes('not') || titleNorm.includes('rotate')))) ||
      (titleNorm.includes('pcb') || titleNorm.includes('control panel')) ||
      ((titleNorm.includes('installation') || titleNorm.includes('reinstallation') || titleNorm.includes('setup')) && titleNorm.includes('washing')) ||
      (titleNorm.includes('water') && (titleNorm.includes('drain') || titleNorm.includes('drainage')));
    const inWmCategory = categoryNorm.includes('washing machine') || (categoryNorm.includes('home appliances') && (wmKeyword || wmSpecificHit));
    if (inWmCategory || wmKeyword || wmSpecificHit) {
      if (titleNorm.includes('deep') && titleNorm.includes('clean')) {
        details.purpose = 'Thorough cleaning and maintenance of washing machine interiors and exteriors.';
        details.benefits = ['Removes detergent residues, dirt, and odor', 'Improves efficiency and lifespan'];
        details.how = ['Drum, filters, detergent tray, and exterior cleaned', 'System inspected and maintained'];
        details.who = ['Periodic maintenance or when machine smells or underperforms.'];
      }
      if (titleNorm.includes('detergent') && titleNorm.includes('dispenser')) {
        details.purpose = 'Repair or replacement of faulty detergent dispensers.';
        details.benefits = ['Ensures proper detergent release for effective washing'];
        details.how = ['Dispenser cleaned', 'Repaired, or replaced as needed'];
        details.who = ['Detergent not dispensing or clogging.'];
      }
      if ((titleNorm.includes('door') && titleNorm.includes('lock')) || titleNorm.includes('gasket')) {
        details.purpose = 'Repair or replacement of door locks and rubber gaskets.';
        details.benefits = ['Prevents leaks', 'Ensures safe operation'];
        details.how = ['Locks/gaskets replaced and properly fitted'];
        details.who = ['Door not locking, leaking, or damaged gaskets.'];
      }
      if ((titleNorm.includes('motor') || titleNorm.includes('pump')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of motors and pumps.';
        details.benefits = ['Restores proper drum rotation and water circulation'];
        details.how = ['Motor/pump tested', 'Repaired or replaced', 'Operation verified'];
        details.who = ['Machine not spinning, draining, or pumping properly.'];
      }
      if (titleNorm.includes('noise') || titleNorm.includes('vibration')) {
        details.purpose = 'Fixing unusual noises or vibrations during operation.';
        details.benefits = ['Prevents damage', 'Ensures smooth operation'];
        details.how = ['Internal components checked', 'Drum balanced', 'Parts repaired/replaced'];
        details.who = ['Loud or shaky washing machine operation.'];
      }
      if (titleNorm.includes('not spinning') || (titleNorm.includes('drum') && (titleNorm.includes('not') || titleNorm.includes('rotate')))) {
        details.purpose = 'Repairing drums that fail to rotate.';
        details.benefits = ['Ensures proper washing and spinning cycles'];
        details.how = ['Motor, belt, or drum assembly inspected and repaired'];
        details.who = ['Drum not spinning or washing ineffective.'];
      }
      if (titleNorm.includes('pcb') || titleNorm.includes('control panel')) {
        details.purpose = 'Repair or replacement of the washing machine’s PCB or control panel.';
        details.benefits = ['Restores correct program cycles and functionality'];
        details.how = ['Control panel tested', 'Circuits repaired or replaced'];
        details.who = ['Machine not responding to programs or buttons.'];
      }
      if ((titleNorm.includes('installation') || titleNorm.includes('reinstallation') || titleNorm.includes('setup')) && titleNorm.includes('washing')) {
        details.purpose = 'Professional setup or reinstallation after shifting.';
        details.benefits = ['Ensures safe connections and proper operation'];
        details.how = ['Machine mounted', 'Water and power connections secured', 'Tested'];
        details.who = ['New machine setup or relocation.'];
      }
      if (titleNorm.includes('water') && (titleNorm.includes('drain') || titleNorm.includes('drainage'))) {
        details.purpose = 'Repairing drainage issues in washing machines.';
        details.benefits = ['Ensures complete water removal for washing and spinning'];
        details.how = ['Drain filters, hoses, and pumps checked and repaired'];
        details.who = ['Machine not draining or water remains inside drum.'];
      }
    }

    // Water Cooler Services
    const wcKeyword = titleNorm.includes('water cooler') || titleNorm.includes('cooler');
    const wcSpecificHit =
      ((titleNorm.includes('compressor') || titleNorm.includes('gas')) && (titleNorm.includes('refill') || titleNorm.includes('repair'))) ||
      (titleNorm.includes('cooling') && (titleNorm.includes('not') || titleNorm.includes('slow'))) ||
      ((titleNorm.includes('motor') || titleNorm.includes('fan')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('preventive') && titleNorm.includes('maintenance')) ||
      ((titleNorm.includes('tank') || titleNorm.includes('storage')) && (titleNorm.includes('clean') || titleNorm.includes('sanitize'))) ||
      ((titleNorm.includes('tap') || titleNorm.includes('pipe')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace'))) ||
      ((titleNorm.includes('installation') || titleNorm.includes('setup')) && titleNorm.includes('cooler')) ||
      (titleNorm.includes('water') && titleNorm.includes('leak'));
    const inWcCategory = categoryNorm.includes('water cooler') || (categoryNorm.includes('home appliances') && (wcKeyword || wcSpecificHit));
    if (inWcCategory || wcKeyword || wcSpecificHit) {
      if ((titleNorm.includes('compressor') || titleNorm.includes('gas')) && (titleNorm.includes('refill') || titleNorm.includes('repair'))) {
        details.purpose = 'Repair or refilling of cooling compressors and refrigerant gas.';
        details.benefits = ['Ensures efficient cooling', 'Uninterrupted operation'];
        details.how = ['Compressor and gas circuits inspected', 'Gas refilled', 'Compressor repaired/replaced'];
        details.who = ['Cooler not chilling or cooling slowly.'];
      }
      if (titleNorm.includes('cooling') && (titleNorm.includes('not') || titleNorm.includes('slow'))) {
        details.purpose = 'Fixing general cooling problems.';
        details.benefits = ['Maintains water at desired temperature'];
        details.how = ['Cooling system tested', 'Faulty components repaired/replaced'];
        details.who = ['Water not cold or cooling unevenly.'];
      }
      if ((titleNorm.includes('motor') || titleNorm.includes('fan')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of fan/motor in the cooler.';
        details.benefits = ['Ensures proper airflow', 'Efficient cooling'];
        details.how = ['Motor/fan inspected', 'Repaired or replaced', 'System tested'];
        details.who = ['Fans not working or unusual noise during operation.'];
      }
      if (titleNorm.includes('preventive') && titleNorm.includes('maintenance')) {
        details.purpose = 'Periodic servicing to maintain performance and hygiene.';
        details.benefits = ['Extends lifespan', 'Prevents breakdowns'];
        details.how = ['Cleaning', 'Lubrication', 'System inspection performed'];
        details.who = ['Regular maintenance before peak summer months.'];
      }
      if ((titleNorm.includes('tank') || titleNorm.includes('storage')) && (titleNorm.includes('clean') || titleNorm.includes('sanitize'))) {
        details.purpose = 'Cleaning and disinfecting water storage tanks.';
        details.benefits = ['Ensures safe and hygienic drinking water'];
        details.how = ['Tanks emptied', 'Scrubbed', 'Disinfected', 'Refilled'];
        details.who = ['Periodic hygiene maintenance or odor issues.'];
      }
      if ((titleNorm.includes('tap') || titleNorm.includes('pipe')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of taps and water pipes.';
        details.benefits = ['Prevents leakage', 'Ensures smooth water flow'];
        details.how = ['Damaged taps/pipes replaced and secured'];
        details.who = ['Leaking or malfunctioning taps and pipes.'];
      }
      if ((titleNorm.includes('installation') || titleNorm.includes('setup')) && titleNorm.includes('cooler')) {
        details.purpose = 'Professional installation of new water coolers.';
        details.benefits = ['Ensures correct electrical and water connections'];
        details.how = ['Cooler mounted', 'Connected to power and water', 'Tested for operation'];
        details.who = ['New cooler setup or after relocation.'];
      }
      if (titleNorm.includes('water') && titleNorm.includes('leak')) {
        details.purpose = 'Repairing leaks from water tanks or pipes.';
        details.benefits = ['Prevents water wastage', 'Prevents damage to surroundings'];
        details.how = ['Leaks identified', 'Seals replaced', 'System tested'];
        details.who = ['Water dripping inside/outside or pooling around cooler.'];
      }
    }

    // Water Purifier & Services
    const purifierKeyword = titleNorm.includes('water purifier') || titleNorm.includes('purifier') || titleNorm.includes('ro ') || titleNorm.includes(' uv ');
    const purifierSpecificHit =
      titleNorm.includes('amc') || titleNorm.includes('annual maintenance') ||
      (titleNorm.includes('complete') && (titleNorm.includes('clean') || titleNorm.includes('sanitize'))) ||
      (titleNorm.includes('general') && (titleNorm.includes('servicing') || titleNorm.includes('service')) || (titleNorm.includes('filter') && titleNorm.includes('replacement'))) ||
      (titleNorm.includes('low water flow') || (titleNorm.includes('low') && titleNorm.includes('flow'))) ||
      ((titleNorm.includes('pump') || titleNorm.includes('motor')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('ro') && titleNorm.includes('membrane')) ||
      titleNorm.includes('tds') ||
      (titleNorm.includes('uv') && titleNorm.includes('lamp')) ||
      (titleNorm.includes('water') && titleNorm.includes('leak'));
    const inPurifierCategory = categoryNorm.includes('water purifier') || categoryNorm.includes('water purifier & services') || (categoryNorm.includes('home appliances') && (purifierKeyword || purifierSpecificHit));
    if (inPurifierCategory || purifierKeyword || purifierSpecificHit) {
      if (titleNorm.includes('amc') || titleNorm.includes('annual maintenance')) {
        details.purpose = 'Subscription-based maintenance service for your water purifier.';
        details.benefits = ['Ensures regular checkups', 'Timely servicing', 'Uninterrupted operation'];
        details.how = ['Technicians visit periodically for inspection', 'Cleaning', 'Minor repairs'];
        details.who = ['Customers wanting hassle-free, periodic maintenance and extended purifier life.'];
      }
      if (titleNorm.includes('complete') && (titleNorm.includes('clean') || titleNorm.includes('sanitize'))) {
        details.purpose = 'Thorough cleaning and disinfecting of the entire purifier unit.';
        details.benefits = ['Removes dirt, biofilm, and harmful bacteria', 'Ensures safe drinking water'];
        details.how = ['Unit disassembled', 'Tanks, filters, and pipes sanitized', 'Reassembled and tested'];
        details.who = ['Periodic hygiene maintenance or purifier showing foul smell/taste.'];
      }
      if ((titleNorm.includes('general') && (titleNorm.includes('servicing') || titleNorm.includes('service'))) || (titleNorm.includes('filter') && titleNorm.includes('replacement'))) {
        details.purpose = 'Regular maintenance including filter checks and replacement.';
        details.benefits = ['Ensures optimal water purification', 'Smooth operation'];
        details.how = ['Filters inspected and replaced if required', 'System tested'];
        details.who = ['Scheduled maintenance or reduced water quality.'];
      }
      if (titleNorm.includes('low water flow') || (titleNorm.includes('low') && titleNorm.includes('flow'))) {
        details.purpose = 'Fixing issues causing slow water flow from the purifier.';
        details.benefits = ['Ensures adequate water supply', 'Proper filtration'];
        details.how = ['Pipes, filters, and valves inspected', 'Cleaned or repaired'];
        details.who = ['Water flowing slowly or intermittently.'];
      }
      if ((titleNorm.includes('pump') || titleNorm.includes('motor')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of water pumps and motors.';
        details.benefits = ['Ensures consistent water pressure', 'Smooth operation'];
        details.how = ['Pump/motor tested', 'Repaired or replaced', 'System checked'];
        details.who = ['Reduced or no water output due to pump/motor issues.'];
      }
      if (titleNorm.includes('ro') && titleNorm.includes('membrane')) {
        details.purpose = 'Replacement of faulty or worn-out RO membranes.';
        details.benefits = ['Maintains proper filtration', 'Safe drinking water quality'];
        details.how = ['Old membrane removed', 'New one installed', 'System tested'];
        details.who = ['Water quality issues or frequent TDS fluctuations.'];
      }
      if (titleNorm.includes('tds')) {
        details.purpose = 'Adjusting Total Dissolved Solids (TDS) for optimal water quality.';
        details.benefits = ['Ensures safe and balanced drinking water'];
        details.how = ['TDS controller calibrated', 'System tested for accuracy'];
        details.who = ['Water too salty, bitter, or inconsistent in taste.'];
      }
      if (titleNorm.includes('uv') && titleNorm.includes('lamp')) {
        details.purpose = 'Replacement of UV lamps in purifiers.';
        details.benefits = ['Maintains effective sterilization and purification'];
        details.how = ['Old lamp removed', 'New lamp installed', 'Tested for proper functioning'];
        details.who = ['UV lamp expired or purifier not sterilizing effectively.'];
      }
      if (titleNorm.includes('water') && titleNorm.includes('leak')) {
        details.purpose = 'Repairing leaks in pipes, tanks, or joints of the purifier.';
        details.benefits = ['Prevents water wastage', 'Maintains purifier efficiency'];
        details.how = ['Leaks identified', 'Seals replaced', 'Joints tightened', 'System tested'];
        details.who = ['Water dripping from the purifier or pooling around it.'];
      }
    }

    // Cleaning & Pest Control Services
    const cleanPestKeyword = titleNorm.includes('cleaning') || titleNorm.includes('pest') || titleNorm.includes('termite') || titleNorm.includes('cockroach');
    const cleanPestSpecificHit =
      (titleNorm.includes('bathroom') && titleNorm.includes('clean')) ||
      (titleNorm.includes('home') && titleNorm.includes('deep') && titleNorm.includes('clean')) ||
      (titleNorm.includes('kitchen') && titleNorm.includes('clean')) ||
      titleNorm.includes('termite') || titleNorm.includes('cockroach');
    const inCleanPestCategory = categoryNorm.includes('cleaning & pest control services') || categoryNorm.includes('cleaning') || categoryNorm.includes('pest control');
    if (inCleanPestCategory || cleanPestKeyword || cleanPestSpecificHit) {
      if (titleNorm.includes('bathroom') && titleNorm.includes('clean')) {
        details.purpose = 'Deep cleaning of bathroom fixtures, tiles, and sanitary ware.';
        details.benefits = ['Maintains hygiene', 'Prevents bacterial growth', 'Keeps the bathroom sparkling'];
        details.how = ['Surfaces scrubbed', 'Drains cleaned', 'Disinfectants applied', 'Odor removed'];
        details.who = ['Regular maintenance or periodic deep cleaning.'];
      }
      if (titleNorm.includes('home') && titleNorm.includes('deep') && titleNorm.includes('clean')) {
        details.purpose = 'Comprehensive cleaning of the entire home, including floors, walls, and furniture.';
        details.benefits = ['Removes dust, dirt, and allergens', 'Improves indoor hygiene'];
        details.how = ['Rooms cleaned thoroughly', 'Carpets/vacuuming', 'Dusting and polishing done'];
        details.who = ['Periodic maintenance, before events, or after renovations.'];
      }
      if (titleNorm.includes('kitchen') && titleNorm.includes('clean')) {
        details.purpose = 'Cleaning of kitchen surfaces, cabinets, sinks, and appliances.';
        details.benefits = ['Prevents bacterial growth', 'Removes grease', 'Maintains hygiene'];
        details.how = ['Surfaces scrubbed', 'Sink cleaned', 'Grease removed', 'Appliances wiped down'];
        details.who = ['Regular maintenance or deep cleaning before special occasions.'];
      }
      if (titleNorm.includes('termite') || titleNorm.includes('cockroach')) {
        details.purpose = 'Pest control for termites, cockroaches, and other household pests.';
        details.benefits = ['Protects property', 'Prevents health hazards', 'Maintains hygiene'];
        details.how = ['Safe chemicals applied to affected areas', 'Traps placed', 'Follow‑up checks done'];
        details.who = ['Presence of pests or periodic preventive treatment.'];
      }
    }

    // Carpentry Services
    const carpentryKeyword = titleNorm.includes('carpentry') || titleNorm.includes('wood') || titleNorm.includes('furniture') || titleNorm.includes('door') || titleNorm.includes('window');
    const carpentrySpecificHit =
      ((titleNorm.includes('door') || titleNorm.includes('window')) && (titleNorm.includes('fitting') || titleNorm.includes('installation') || titleNorm.includes('adjust'))) ||
      (titleNorm.includes('furniture') && titleNorm.includes('repair')) ||
      (titleNorm.includes('modular') && titleNorm.includes('kitchen') && titleNorm.includes('installation')) ||
      (titleNorm.includes('wood') && titleNorm.includes('polish')) || titleNorm.includes('wooden polishing');
    const inCarpentryCategory = categoryNorm.includes('carpentry services') || categoryNorm.includes('carpentry');
    if (inCarpentryCategory || carpentryKeyword || carpentrySpecificHit) {
      if (((titleNorm.includes('door') || titleNorm.includes('window')) && (titleNorm.includes('fitting') || titleNorm.includes('installation') || titleNorm.includes('adjust')))) {
        details.purpose = 'Installation or adjustment of doors and windows.';
        details.benefits = ['Ensures smooth operation', 'Security', 'Proper alignment'];
        details.how = ['Frames measured', 'Doors/windows mounted', 'Hinges and locks adjusted'];
        details.who = ['New installation or replacement of old doors/windows.'];
      }
      if (titleNorm.includes('furniture') && titleNorm.includes('repair')) {
        details.purpose = 'Repair of damaged or worn‑out furniture.';
        details.benefits = ['Restores functionality and appearance'];
        details.how = ['Joints, hinges, scratches, or broken parts repaired or replaced'];
        details.who = ['Old, damaged, or broken furniture.'];
      }
      if (titleNorm.includes('modular') && titleNorm.includes('kitchen') && titleNorm.includes('installation')) {
        details.purpose = 'Professional installation of modular kitchen units.';
        details.benefits = ['Ensures proper assembly', 'Alignment', 'Usability'];
        details.how = ['Cabinets assembled', 'Fixtures installed', 'Setup tested'];
        details.who = ['New kitchen setup or renovation projects.'];
      }
      if ((titleNorm.includes('wood') && titleNorm.includes('polish')) || titleNorm.includes('wooden polishing')) {
        details.purpose = 'Polishing and finishing wooden furniture and surfaces.';
        details.benefits = ['Enhances appearance', 'Protects wood', 'Removes scratches'];
        details.how = ['Surfaces cleaned', 'Sanded', 'Polished using suitable compounds'];
        details.who = ['Dull or scratched wooden furniture.'];
      }
    }

    // Electrical Services
    const electricalKeyword = titleNorm.includes('electrical') || titleNorm.includes('wiring') || titleNorm.includes('switch') || titleNorm.includes('socket') || titleNorm.includes('inverter') || titleNorm.includes('ups') || titleNorm.includes('fan') || titleNorm.includes('light');
    const electricalSpecificHit =
      ((titleNorm.includes('fan') || titleNorm.includes('light')) && (titleNorm.includes('fitting') || titleNorm.includes('installation') || titleNorm.includes('replace'))) ||
      ((titleNorm.includes('inverter') || titleNorm.includes('ups')) && (titleNorm.includes('installation') || titleNorm.includes('repair'))) ||
      ((titleNorm.includes('switch') || titleNorm.includes('socket')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('wiring') && (titleNorm.includes('installation') || titleNorm.includes('install')));
    const inElectricalCategory = categoryNorm.includes('electrical services') || categoryNorm.includes('electrical');
    if (inElectricalCategory || electricalKeyword || electricalSpecificHit) {
      if ((titleNorm.includes('fan') || titleNorm.includes('light')) && (titleNorm.includes('fitting') || titleNorm.includes('installation') || titleNorm.includes('replace'))) {
        details.purpose = 'Installation or replacement of fans and lighting fixtures.';
        details.benefits = ['Ensures safe, functional, and aesthetically pleasing setups'];
        details.how = ['Fixtures mounted', 'Wiring secured', 'Connections tested'];
        details.who = ['New installations or replacement of old fixtures.'];
      }
      if ((titleNorm.includes('inverter') || titleNorm.includes('ups')) && (titleNorm.includes('installation') || titleNorm.includes('repair'))) {
        details.purpose = 'Setup and repair of inverters and UPS systems.';
        details.benefits = ['Provides uninterrupted power', 'Reliable backup'];
        details.how = ['Units installed', 'Wired', 'Tested', 'Repairs carried out for malfunctioning systems'];
        details.who = ['New installations or backup/power issues.'];
      }
      if ((titleNorm.includes('switch') || titleNorm.includes('socket')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of faulty switches and sockets.';
        details.benefits = ['Ensures safety', 'Reliable power supply'];
        details.how = ['Faulty switches/sockets tested', 'Repaired or replaced'];
        details.who = ['Sparks, loose fittings, or non‑functional switches.'];
      }
      if (titleNorm.includes('wiring') && (titleNorm.includes('installation') || titleNorm.includes('install'))) {
        details.purpose = 'Electrical wiring and installation for homes/offices.';
        details.benefits = ['Ensures safe and efficient power distribution'];
        details.how = ['Wires laid', 'Connections secured', 'Circuits tested for safety'];
        details.who = ['New wiring setups or electrical renovations.'];
      }
    }

    // Men’s Salon Services
    const mensSalonKeyword = titleNorm.includes('beard') || titleNorm.includes('facial') || titleNorm.includes('hair') || titleNorm.includes('massage');
    const inMensSalonCategory = categoryNorm.includes("men's salon") || categoryNorm.includes('mens salon') || categoryNorm.includes('men salon') || categoryNorm.includes('salon');
    if (inMensSalonCategory || mensSalonKeyword) {
      if (titleNorm.includes('beard') && (titleNorm.includes('groom') || titleNorm.includes('trim'))) {
        details.purpose = 'Professional trimming, shaping, and grooming of beard.';
        details.benefits = ['Enhances facial look', 'Keeps beard neat and stylish'];
        details.how = ['Beard styled with trimmers, scissors, and finishing products'];
        details.who = ['Customers wanting a sharp, clean, or trendy beard style.'];
      }
      if ((titleNorm.includes('facial') || titleNorm.includes('cleanup'))) {
        details.purpose = 'Deep cleansing and facial treatment for glowing skin.';
        details.benefits = ['Removes dirt, oil, and dead skin', 'Refreshes appearance'];
        details.how = ['Cleansing', 'Scrubbing', 'Steaming', 'Mask application'];
        details.who = ['Dull, tired-looking skin or regular skincare.'];
      }
      if (titleNorm.includes('hair') && titleNorm.includes('color')) {
        details.purpose = 'Hair coloring services with safe, high-quality products.';
        details.benefits = ['Covers grey hair', 'Adds new trendy shades'];
        details.how = ['Professional hair coloring with protective care'];
        details.who = ['Customers wanting hair color changes or grey coverage.'];
      }
      if ((titleNorm.includes('haircut') || (titleNorm.includes('hair') && titleNorm.includes('styling')))) {
        details.purpose = 'Customized haircuts with professional styling.';
        details.benefits = ['Maintains neat looks', 'Enhances personality'];
        details.how = ['Hair cut', 'Washed', 'Styled as per preference'];
        details.who = ['Routine haircuts or trendy styles.'];
      }
      if (titleNorm.includes('head') && titleNorm.includes('massage')) {
        details.purpose = 'Relaxing massage for scalp and head area.';
        details.benefits = ['Relieves stress', 'Improves blood circulation', 'Promotes hair growth'];
        details.how = ['Oils applied', 'Gentle massage techniques followed'];
        details.who = ['Customers seeking relaxation or scalp care.'];
      }
    }

    // Painting & Renovation Services
    const paintRenovKeyword = titleNorm.includes('painting') || titleNorm.includes('false ceiling') || titleNorm.includes('waterproof');
    const inPaintRenovCategory = categoryNorm.includes('painting & renovation') || categoryNorm.includes('painting') || categoryNorm.includes('renovation');
    if (inPaintRenovCategory || paintRenovKeyword) {
      if (titleNorm.includes('false ceiling')) {
        details.purpose = 'Installation or repair of false ceilings.';
        details.benefits = ['Enhances aesthetics', 'Improves insulation', 'Better lighting options'];
        details.how = ['Frames installed', 'Boards fixed', 'Finishing and painting done'];
        details.who = ['Renovating or upgrading interiors.'];
      }
      if ((titleNorm.includes('interior') || titleNorm.includes('exterior')) && titleNorm.includes('painting')) {
        details.purpose = 'Professional wall painting services for homes and offices.';
        details.benefits = ['Refreshes look', 'Protects walls', 'Adds style'];
        details.how = ['Walls prepped', 'Primed', 'Painted with high-quality paints'];
        details.who = ['Customers needing repainting or new interiors.'];
      }
      if (titleNorm.includes('wall') && titleNorm.includes('texture')) {
        details.purpose = 'Designer wall textures and finishes.';
        details.benefits = ['Adds uniqueness', 'Modern appeal to spaces'];
        details.how = ['Special paints and texture tools applied to walls'];
        details.who = ['Homes/offices wanting stylish feature walls.'];
      }
      if (titleNorm.includes('waterproof')) {
        details.purpose = 'Seepage and leakage prevention treatment.';
        details.benefits = ['Protects walls, ceilings, and structures from water damage'];
        details.how = ['Waterproofing chemicals and sealants applied'];
        details.who = ['Homes with dampness, leakage, or wall cracks.'];
      }
    }

    // Pet Boarding & Sitting Services
    const petKeyword = titleNorm.includes('pet') || titleNorm.includes('boarding') || titleNorm.includes('sitting') || titleNorm.includes('walking') || titleNorm.includes('daycare');
    const inPetCategory = categoryNorm.includes('pet boarding & sitting services') || categoryNorm.includes('pet services') || categoryNorm.includes('pets');
    if (inPetCategory || petKeyword) {
      if (titleNorm.includes('daycare')) {
        details.purpose = 'Safe and playful environment for pets during the day.';
        details.benefits = ['Ensures pets are cared for when owners are away'];
        details.how = ['Pets supervised', 'Fed', 'Exercised', 'Engaged in play'];
        details.who = ['Owners with busy workdays or short trips.'];
      }
      if (titleNorm.includes('home') && titleNorm.includes('sitting')) {
        details.purpose = 'At-home visits for feeding, walking, and caring for pets.';
        details.benefits = ['Keeps pets comfortable at home with regular care'];
        details.how = ['Sitter visits', 'Feeds', 'Cleans', 'Plays with pets'];
        details.who = ['Owners preferring home care instead of boarding.'];
      }
      if (titleNorm.includes('overnight') || titleNorm.includes('boarding')) {
        details.purpose = 'Full-night stay facility for pets with safe and cozy care.';
        details.benefits = ['Provides care and companionship when owners travel'];
        details.how = ['Pets accommodated overnight with food', 'Exercise', 'Monitoring'];
        details.who = ['Owners going out of town or on long trips.'];
      }
      if (titleNorm.includes('walking')) {
        details.purpose = 'Professional pet walking for exercise and health.';
        details.benefits = ['Ensures pets get daily walks and physical activity'];
        details.how = ['Pets taken for safe, guided walks'];
        details.who = ['Busy owners unable to walk pets daily.'];
      }
    }

    // Pet Grooming
    const petGroomKeyword = titleNorm.includes('groom') || titleNorm.includes('bath') || titleNorm.includes('tick') || titleNorm.includes('flea') || titleNorm.includes('coat') || titleNorm.includes('styling') || titleNorm.includes('nail') || titleNorm.includes('ear');
    const inPetGroomCategory = categoryNorm.includes('pet grooming') || (categoryNorm.includes('pet services') && petGroomKeyword);
    if (inPetGroomCategory || petGroomKeyword) {
      if ((titleNorm.includes('basic') && titleNorm.includes('bath')) || (titleNorm.includes('hygiene') && titleNorm.includes('bath'))) {
        details.purpose = 'Gentle bathing with pet-safe products for cleanliness and freshness.';
        details.benefits = ['Maintains hygiene', 'Removes dirt, odor, and germs'];
        details.how = ['Pets are bathed, dried, and brushed using specialized shampoos'];
        details.who = ['Pet owners wanting regular grooming for their pets.'];
      }
      if ((titleNorm.includes('nail') && titleNorm.includes('trim')) || titleNorm.includes('ear cleaning')) {
        details.purpose = 'Careful trimming of nails and thorough ear cleaning.';
        details.benefits = ['Prevents discomfort, infections, and injuries'];
        details.how = ['Safe tools used to trim nails and clean ears hygienically'];
        details.who = ['Pets with fast-growing nails or recurring ear issues.'];
      }
      if ((titleNorm.includes('styling') || titleNorm.includes('coat')) && (titleNorm.includes('care') || titleNorm.includes('style'))) {
        details.purpose = 'Professional grooming for coat styling and shine.';
        details.benefits = ['Enhances pet appearance', 'Keeps coat healthy'];
        details.how = ['Includes brushing', 'Trimming', 'Coat styling'];
        details.who = ['Owners who want their pets to look stylish and well-kept.'];
      }
      if (titleNorm.includes('tick') || titleNorm.includes('flea')) {
        details.purpose = 'Specialized treatment to remove ticks and fleas.';
        details.benefits = ['Protects pets from skin irritation and diseases'];
        details.how = ['Medicated baths or topical treatments applied'];
        details.who = ['Pets exposed to outdoor environments or showing symptoms.'];
      }
    }

    // Pet Health & Training
    const petHealthKeyword = titleNorm.includes('nutrition') || titleNorm.includes('diet') || titleNorm.includes('obedience') || titleNorm.includes('training') || titleNorm.includes('vaccination') || titleNorm.includes('veterinary') || titleNorm.includes('consultation');
    const inPetHealthCategory = categoryNorm.includes('pet health & training') || (categoryNorm.includes('pet services') && petHealthKeyword);
    if (inPetHealthCategory || petHealthKeyword) {
      if ((titleNorm.includes('nutrition') || titleNorm.includes('diet')) && titleNorm.includes('consult')) {
        details.purpose = 'Expert advice on healthy pet diet planning.';
        details.benefits = ['Ensures pets get proper nutrition for growth and energy'];
        details.how = ['Customized diet charts based on breed, age, and health'];
        details.who = ['Owners concerned about their pet’s nutrition and health.'];
      }
      if (titleNorm.includes('obedience') || (titleNorm.includes('training') && titleNorm.includes('basic'))) {
        details.purpose = 'Training sessions for basic commands and discipline.';
        details.benefits = ['Helps pets learn manners', 'Improves behavior'];
        details.how = ['Step-by-step command training with positive reinforcement'];
        details.who = ['Owners wanting well-disciplined and obedient pets.'];
      }
      if (titleNorm.includes('vaccination')) {
        details.purpose = 'Complete set of vaccinations for pets.';
        details.benefits = ['Protects against common diseases and infections'];
        details.how = ['Administered by licensed veterinarians as per schedule'];
        details.who = ['Pet owners ensuring long-term health and safety.'];
      }
      if (titleNorm.includes('veterinary') || (titleNorm.includes('consult') && titleNorm.includes('vet'))) {
        details.purpose = 'Professional health check-up and advice for pets.';
        details.benefits = ['Early detection and treatment of health issues'];
        details.how = ['Physical examination and medical recommendations'];
        details.who = ['Owners noticing unusual behavior or health concerns in pets.'];
      }
    }

    // Unisex & Spa
    const spaKeyword = titleNorm.includes('spa') || titleNorm.includes('massage') || titleNorm.includes('relaxation') || titleNorm.includes('skin care');
    const inSpaCategory = categoryNorm.includes('unisex & spa') || categoryNorm.includes('spa');
    if (inSpaCategory || spaKeyword) {
      if (titleNorm.includes('body massage')) {
        details.purpose = 'Full-body massage for relaxation and muscle relief.';
        details.benefits = ['Reduces stress', 'Improves blood circulation', 'Relieves pain'];
        details.how = ['Performed by trained therapists using oils and massage techniques'];
        details.who = ['Anyone needing stress relief, muscle relaxation, or rejuvenation.'];
      }
      if (titleNorm.includes('hair spa') || (titleNorm.includes('hair') && titleNorm.includes('treatment'))) {
        details.purpose = 'Nourishing hair spa and professional treatments.';
        details.benefits = ['Strengthens hair', 'Reduces dandruff', 'Promotes shine'];
        details.how = ['Includes scalp massage', 'Steaming', 'Conditioning'];
        details.who = ['People with dry, damaged, or dull hair.'];
      }
      if (titleNorm.includes('relaxation')) {
        details.purpose = 'Therapies designed for mental and physical relaxation.';
        details.benefits = ['Relieves anxiety', 'Promotes calmness', 'Refreshes the body'];
        details.how = ['Aromatherapy', 'Meditation-based sessions', 'Healing techniques'];
        details.who = ['Individuals experiencing stress, fatigue, or restlessness.'];
      }
      if (titleNorm.includes('skin care')) {
        details.purpose = 'Customized skin treatments for glow and health.';
        details.benefits = ['Anti-aging', 'Acne treatment', 'Skin rejuvenation'];
        details.how = ['Facials', 'Scrubs', 'Masks', 'Advanced skin therapies'];
        details.who = ['Anyone wanting improved skin tone, texture, or glow.'];
      }
    }

    // Women’s Salon
    const womenSalonKeyword = titleNorm.includes('bridal') || titleNorm.includes('facial') || titleNorm.includes('cleanup') || titleNorm.includes('hair') || titleNorm.includes('manicure') || titleNorm.includes('pedicure') || titleNorm.includes('wax') || titleNorm.includes('thread');
    const inWomenSalonCategory = categoryNorm.includes("women's salon") || categoryNorm.includes('womens salon') || categoryNorm.includes('women salon') || categoryNorm.includes('salon');
    if (inWomenSalonCategory || womenSalonKeyword) {
      if (titleNorm.includes('bridal')) {
        details.purpose = 'Professional bridal makeup with premium products.';
        details.benefits = ['Enhances beauty and confidence for the special day'];
        details.how = ['Customized makeup', 'Hairstyling', 'Touch-up services'];
        details.who = ['Brides preparing for wedding events.'];
      }
      if (titleNorm.includes('facial') || titleNorm.includes('cleanup')) {
        details.purpose = 'Deep cleansing and facial treatments for fresh skin.';
        details.benefits = ['Removes dirt and blackheads', 'Rejuvenates skin'];
        details.how = ['Cleansing', 'Scrubbing', 'Steaming', 'Mask application'];
        details.who = ['Women needing glowing, refreshed, and clear skin.'];
      }
      if ((titleNorm.includes('hair') && (titleNorm.includes('color') || titleNorm.includes('highlight')))) {
        details.purpose = 'Professional hair coloring and highlighting services.';
        details.benefits = ['Enhances look', 'Covers greys', 'Adds style'];
        details.how = ['Safe coloring techniques with long-lasting shades'];
        details.who = ['Women wanting a stylish or refreshed hair look.'];
      }
      if ((titleNorm.includes('haircut') || (titleNorm.includes('hair') && titleNorm.includes('styling')))) {
        details.purpose = 'Trendy haircuts with expert styling.';
        details.benefits = ['Keeps hair healthy', 'Stylish', 'Well-shaped'];
        details.how = ['Customized haircut and blow-dry/styling'];
        details.who = ['Women wanting a new look or regular trims.'];
      }
      if (titleNorm.includes('manicure') || titleNorm.includes('pedicure')) {
        details.purpose = 'Hand and foot care with nail grooming.';
        details.benefits = ['Maintains hygiene', 'Enhances beauty'];
        details.how = ['Cleaning', 'Exfoliating', 'Massaging', 'Nail polishing'];
        details.who = ['Women wanting neat, healthy, and beautiful hands/feet.'];
      }
      if ((titleNorm.includes('wax')) || titleNorm.includes('thread')) {
        details.purpose = 'Hair removal for smooth and clean skin.';
        details.benefits = ['Ensures hygiene', 'Enhances appearance'];
        details.how = ['Waxing for arms/legs', 'Threading for facial hair'];
        details.who = ['Women preferring smooth, hair-free skin.'];
      }
    }
    // Plumbing Services
    const plumbingKeyword = titleNorm.includes('plumbing') || titleNorm.includes('pipe') || titleNorm.includes('tap') || titleNorm.includes('sink') || titleNorm.includes('bathroom') || titleNorm.includes('kitchen');
    const inPlumbingCategory = categoryNorm.includes('plumbing services') || categoryNorm.includes('plumbing');
    if (inPlumbingCategory || plumbingKeyword) {
      if ((titleNorm.includes('bathroom') || titleNorm.includes('kitchen')) && titleNorm.includes('fitting')) {
        details.purpose = 'Installation and replacement of bathroom/kitchen fixtures.';
        details.benefits = ['Ensures proper functionality', 'Modern fittings'];
        details.how = ['Professionals install taps', 'Showers', 'Sinks', 'Accessories'];
        details.who = ['Homeowners renovating or upgrading bathrooms/kitchens.'];
      }
      if ((titleNorm.includes('pipe') || titleNorm.includes('leakage') || titleNorm.includes('leak')) && titleNorm.includes('fix')) {
        details.purpose = 'Quick repair of leaking pipes and joints.';
        details.benefits = ['Prevents water wastage', 'Prevents property damage'];
        details.how = ['Leakage detection', 'Sealing', 'Replacement if required'];
        details.who = ['Anyone facing water leakage at home or office.'];
      }
      if ((titleNorm.includes('tap') || titleNorm.includes('sink')) && (titleNorm.includes('repair') || titleNorm.includes('service'))) {
        details.purpose = 'Repair and servicing of faulty taps and sinks.';
        details.benefits = ['Prevents water dripping', 'Prevents clogging and wastage'];
        details.how = ['Parts repaired or replaced for smooth water flow'];
        details.who = ['Households facing dripping taps or blocked sinks.'];
      }
      if (titleNorm.includes('water tank') && titleNorm.includes('clean')) {
        details.purpose = 'Deep cleaning and sanitization of water tanks.';
        details.benefits = ['Removes dirt, algae, and harmful bacteria'];
        details.how = ['Tanks emptied', 'Scrubbed', 'Disinfected', 'Rinsed'];
        details.who = ['Homes/offices that haven’t cleaned water tanks in months.'];
      }
    }
    // Fan Repair & Services
    const fanKeyword = titleNorm.includes('fan') || titleNorm.includes('ceiling fan') || titleNorm.includes('exhaust fan');
    const fanSpecificHit =
      ((titleNorm.includes('blade') && (titleNorm.includes('balance') || titleNorm.includes('balancing'))) || titleNorm.includes('alignment')) ||
      titleNorm.includes('capacitor') ||
      (titleNorm.includes('ceiling') && (titleNorm.includes('installation') || titleNorm.includes('install') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('motor') && (titleNorm.includes('rewind') || titleNorm.includes('repair'))) ||
      titleNorm.includes('lubrication') || titleNorm.includes('regulator') ||
      titleNorm.includes('switch') || titleNorm.includes('wiring') ||
      titleNorm.includes('table') || titleNorm.includes('wall') || titleNorm.includes('exhaust');
    const inFanCategory =
      categoryNorm.includes('fan repair & services') ||
      categoryNorm.includes('fans repair & services') ||
      categoryNorm.includes('fan repair') ||
      categoryNorm.includes('fan services') ||
      categoryNorm.includes('ceiling fan') ||
      categoryNorm.includes('exhaust fan') ||
      categoryNorm.includes('fan') ||
      (categoryNorm.includes('home appliances') && (fanKeyword || fanSpecificHit));
    if (inFanCategory || fanKeyword || fanSpecificHit) {
      if ((titleNorm.includes('blade') && (titleNorm.includes('balance') || titleNorm.includes('balancing'))) || titleNorm.includes('alignment')) {
        details.purpose = 'Cleaning, balancing, and aligning fan blades for smooth rotation.';
        details.benefits = ['Prevents wobbling', 'Reduces noise', 'Prolongs motor life'];
        details.how = ['Blades cleaned', 'Balanced', 'Aligned', 'Tested for smooth operation'];
        details.who = ['Fans wobbling or vibrating during use.'];
      }
      if (titleNorm.includes('capacitor')) {
        details.purpose = 'Replacement of faulty capacitors in ceiling or table fans.';
        details.benefits = ['Ensures proper fan speed', 'Smooth start'];
        details.how = ['Capacitor tested', 'Replaced with compatible unit'];
        details.who = ['Fans not starting or running slowly.'];
      }
      if ((titleNorm.includes('ceiling') && (titleNorm.includes('installation') || titleNorm.includes('install') || titleNorm.includes('replacement') || titleNorm.includes('replace')))) {
        details.purpose = 'Professional installation or replacement of ceiling fans.';
        details.benefits = ['Ensures secure mounting', 'Safe electrical connections'];
        details.how = ['Old fan removed (if needed)', 'New fan installed', 'Wiring secured', 'Tested for proper operation'];
        details.who = ['New fans purchased or old fans being replaced.'];
      }
      if (titleNorm.includes('motor') && (titleNorm.includes('rewind') || titleNorm.includes('repair'))) {
        details.purpose = 'Repair or rewinding of faulty fan motors.';
        details.benefits = ['Restores proper function', 'Prevents overheating or noise'];
        details.how = ['Motor disassembled', 'Rewound/repaired', 'Reassembled and tested'];
        details.who = ['Non-working or inefficient fans.'];
      }
      if (titleNorm.includes('noise') || titleNorm.includes('lubrication') || titleNorm.includes('lubricate')) {
        details.purpose = 'Reduces noise and ensures smooth rotation.';
        details.benefits = ['Minimizes friction', 'Prolongs fan life'];
        details.how = ['Fan lubricated', 'Loose parts tightened', 'Noise sources addressed'];
        details.who = ['Noisy or squeaky fans.'];
      }
      if (titleNorm.includes('regulator')) {
        details.purpose = 'Fixing or replacing fan regulators.';
        details.benefits = ['Ensures adjustable and stable fan speed'];
        details.how = ['Faulty regulator tested', 'Repaired or replaced'];
        details.who = ['Fans not responding to speed changes.'];
      }
      if ((titleNorm.includes('switch') || titleNorm.includes('wiring'))) {
        details.purpose = 'Repair of defective switches and fan wiring.';
        details.benefits = ['Ensures safe and reliable operation'];
        details.how = ['Switches and wiring inspected', 'Repaired or replaced'];
        details.who = ['Fans not turning on/off or showing electrical issues.'];
      }
      if (titleNorm.includes('table') || titleNorm.includes('wall') || titleNorm.includes('exhaust')) {
        details.purpose = 'Repair of smaller fans including wall, table, and exhaust types.';
        details.benefits = ['Restores full functionality and safety'];
        details.how = ['Motors, switches, blades, and wiring repaired/replaced as needed'];
        details.who = ['Fans malfunctioning, noisy, or not running.'];
      }
    }

    // Geyser Repair & Services
    const geyserKeyword = titleNorm.includes('geyser') || titleNorm.includes('water heater');
    const geyserSpecificHit =
      (titleNorm.includes('installation') || titleNorm.includes('install')) && (titleNorm.includes('uninstallation') || titleNorm.includes('uninstall')) ||
      titleNorm.includes('heating element') ||
      titleNorm.includes('overheating') ||
      titleNorm.includes('thermostat') ||
      titleNorm.includes('power supply') || titleNorm.includes('wiring') ||
      (titleNorm.includes('tank') && (titleNorm.includes('clean') || titleNorm.includes('descal'))) ||
      (titleNorm.includes('water leakage') || (titleNorm.includes('water') && titleNorm.includes('leak'))) ||
      titleNorm.includes('noise') || titleNorm.includes('spark');
    const inGeyserCategory = categoryNorm.includes('geyser') || categoryNorm.includes('water heater') || (categoryNorm.includes('home appliances') && (geyserKeyword || geyserSpecificHit));
    if (inGeyserCategory || geyserKeyword || geyserSpecificHit) {
      if ((titleNorm.includes('installation') || titleNorm.includes('install')) && (titleNorm.includes('uninstallation') || titleNorm.includes('uninstall'))) {
        details.purpose = 'Professional installation or removal of electric geysers.';
        details.benefits = ['Ensures secure mounting', 'Safe electrical connections', 'Leak-free operation'];
        details.how = ['Old geyser removed (if needed)', 'New geyser installed', 'Connections tested'];
        details.who = ['New geyser purchase or home shifting.'];
      }
      if (titleNorm.includes('heating element')) {
        details.purpose = 'Replacement of faulty heating elements.';
        details.benefits = ['Ensures proper water heating'];
        details.how = ['Faulty element removed', 'New element installed', 'Tested'];
        details.who = ['Water not heating or heating slowly.'];
      }
      if (titleNorm.includes('noise') || titleNorm.includes('spark')) {
        details.purpose = 'Fixing unusual geyser noises or sparking issues.';
        details.benefits = ['Prevents electrical hazards', 'Maintains quiet operation'];
        details.how = ['Components inspected', 'Faulty parts repaired or replaced'];
        details.who = ['Geysers making noise or sparking.'];
      }
      if (titleNorm.includes('overheating')) {
        details.purpose = 'Repair of geyser overheating problems.';
        details.benefits = ['Prevents damage to unit', 'Ensures safety'];
        details.how = ['Thermostat, heating element, and wiring inspected and repaired'];
        details.who = ['Geysers overheating or tripping safety switches.'];
      }
      if (titleNorm.includes('power supply') || titleNorm.includes('wiring')) {
        details.purpose = 'Repair of faulty wiring or electrical connections.';
        details.benefits = ['Ensures safe and uninterrupted operation'];
        details.how = ['Wiring and connections inspected', 'Repaired or replaced'];
        details.who = ['Geysers not powering on or showing electrical faults.'];
      }
      if (titleNorm.includes('tank') && (titleNorm.includes('clean') || titleNorm.includes('descal'))) {
        details.purpose = 'Cleaning and descaling of the geyser tank.';
        details.benefits = ['Removes mineral buildup', 'Improves heating efficiency', 'Prolongs life'];
        details.how = ['Tank drained', 'Cleaned', 'Descaled', 'Refilled'];
        details.who = ['Periodic maintenance or when heating slows down.'];
      }
      if (titleNorm.includes('thermostat')) {
        details.purpose = 'Fixing or replacing defective thermostats.';
        details.benefits = ['Maintains accurate temperature control and safety'];
        details.how = ['Thermostat tested', 'Repaired or replaced'];
        details.who = ['Water temperature irregular or geyser overheating.'];
      }
      if (titleNorm.includes('water leakage') || (titleNorm.includes('water') && titleNorm.includes('leak'))) {
        details.purpose = 'Repair of leaking geysers.';
        details.benefits = ['Prevents water damage and wastage'];
        details.how = ['Leaks identified', 'Gaskets/seals replaced', 'Fittings tightened'];
        details.who = ['Geysers leaking from tank or connections.'];
      }
    }

    // Inverter & UPS Repair & Services
    const inverterKeyword = titleNorm.includes('inverter') || titleNorm.includes('ups');
    const inverterSpecificHit =
      ((titleNorm.includes('battery') && (titleNorm.includes('replacement') || titleNorm.includes('replace'))) || titleNorm.includes('water top-up') || titleNorm.includes('water top up')) ||
      (titleNorm.includes('charging') && (titleNorm.includes('problem') || titleNorm.includes('issue') || titleNorm.includes('circuit'))) ||
      ((titleNorm.includes('installation') || titleNorm.includes('install')) && (titleNorm.includes('uninstallation') || titleNorm.includes('uninstall'))) ||
      (titleNorm.includes('pcb') || (titleNorm.includes('backup') && (titleNorm.includes('issue') || titleNorm.includes('problem')))) ||
      (titleNorm.includes('no power') || (titleNorm.includes('no') && titleNorm.includes('backup'))) ||
      (titleNorm.includes('overheating') || titleNorm.includes('noise')) ||
      (titleNorm.includes('regular servicing') || titleNorm.includes('load testing') || titleNorm.includes('servicing')) ||
      ((titleNorm.includes('wiring') || titleNorm.includes('fuse')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace')));
    const inInverterCategory = categoryNorm.includes('inverter') || categoryNorm.includes('ups') || categoryNorm.includes('inverter & ups repair & services') || (categoryNorm.includes('home electronics') && (inverterKeyword || inverterSpecificHit));
    if (inInverterCategory || inverterKeyword || inverterSpecificHit) {
      if ((titleNorm.includes('battery') && (titleNorm.includes('replacement') || titleNorm.includes('replace'))) || titleNorm.includes('water top-up') || titleNorm.includes('water top up')) {
        details.purpose = 'Replacement of old batteries or topping up water in lead-acid batteries.';
        details.benefits = ['Ensures optimal backup performance', 'Longer battery life'];
        details.how = ['Batteries tested', 'Faulty ones replaced', 'Water levels topped up as needed'];
        details.who = ['Customers experiencing reduced backup or non-functional batteries.'];
      }
      if (titleNorm.includes('charging') && (titleNorm.includes('problem') || titleNorm.includes('issue') || titleNorm.includes('circuit'))) {
        details.purpose = 'Fixing issues in charging circuitry of inverters/UPS.';
        details.benefits = ['Ensures proper battery charging', 'Uninterrupted power supply'];
        details.how = ['Charging circuits inspected', 'Faults repaired', 'Unit tested'];
        details.who = ['Batteries not charging fully or irregular charging.'];
      }
      if ((titleNorm.includes('installation') || titleNorm.includes('install')) && (titleNorm.includes('uninstallation') || titleNorm.includes('uninstall'))) {
        details.purpose = 'Professional installation or removal of inverter/UPS units.';
        details.benefits = ['Ensures safe setup', 'Proper electrical connections'];
        details.how = ['Unit mounted', 'Wired', 'Tested for output', 'Uninstallation includes safe disconnection'];
        details.who = ['New unit setup or home/office shifting.'];
      }
      if (titleNorm.includes('pcb') || (titleNorm.includes('backup') && (titleNorm.includes('issue') || titleNorm.includes('problem')))) {
        details.purpose = 'Repair of inverter PCBs or backup system malfunctions.';
        details.benefits = ['Restores proper operation', 'Improves backup performance'];
        details.how = ['PCB inspected', 'Repaired or replaced', 'Backup tested'];
        details.who = ['Backup not working or PCB malfunctioning.'];
      }
      if (titleNorm.includes('no power') || (titleNorm.includes('no') && titleNorm.includes('backup'))) {
        details.purpose = 'Troubleshooting inverters/UPS units not supplying power or backup.';
        details.benefits = ['Ensures reliable power during outages'];
        details.how = ['Electrical faults diagnosed and repaired', 'Output verified'];
        details.who = ['Units failing to provide power or backup.'];
      }
      if (titleNorm.includes('overheating') || titleNorm.includes('noise')) {
        details.purpose = 'Fixing overheating units or unusual noise issues.';
        details.benefits = ['Prevents damage', 'Ensures safe operation'];
        details.how = ['Components inspected', 'Fans/lubrication checked', 'Repairs done'];
        details.who = ['Inverters/UPS generating excessive heat or noise.'];
      }
      if (titleNorm.includes('regular servicing') || titleNorm.includes('load testing') || titleNorm.includes('servicing')) {
        details.purpose = 'Preventive maintenance and load testing for reliable performance.';
        details.benefits = ['Extends lifespan', 'Ensures consistent backup supply'];
        details.how = ['Complete inspection', 'Load testing', 'Cleaning', 'Adjustments done'];
        details.who = ['Periodic maintenance or before power outage seasons.'];
      }
      if ((titleNorm.includes('wiring') || titleNorm.includes('fuse')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of damaged wiring and fuses.';
        details.benefits = ['Ensures safe operation', 'Prevents electrical hazards'];
        details.how = ['Faulty wires/fuses replaced', 'Unit tested'];
        details.who = ['Units showing tripped fuses or faulty connections.'];
      }
    }

    // Laptop & PC Repair & Services
    const itKeyword = titleNorm.includes('laptop') || titleNorm.includes('pc') || titleNorm.includes('computer') || titleNorm.includes('desktop');
    const itSpecificHit =
      ((titleNorm.includes('battery') || titleNorm.includes('adapter')) && (titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('data') && (titleNorm.includes('backup') || titleNorm.includes('recovery'))) ||
      ((titleNorm.includes('hard drive') || titleNorm.includes('hdd') || titleNorm.includes('ssd') || titleNorm.includes('ram')) && (titleNorm.includes('upgrade') || titleNorm.includes('upgradation'))) ||
      ((titleNorm.includes('keyboard') || titleNorm.includes('touchpad')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) ||
      ((titleNorm.includes('installation') || titleNorm.includes('setup')) && (titleNorm.includes('laptop') || titleNorm.includes('pc') || titleNorm.includes('computer') || titleNorm.includes('desktop'))) ||
      (titleNorm.includes('network') || titleNorm.includes('connectivity') || titleNorm.includes('wi-fi') || titleNorm.includes('wifi') || titleNorm.includes('lan')) ||
      ((titleNorm.includes('os') || titleNorm.includes('operating system')) && (titleNorm.includes('installation') || titleNorm.includes('upgradation') || titleNorm.includes('upgrade'))) ||
      (titleNorm.includes('overheating') || (titleNorm.includes('fan') && titleNorm.includes('clean'))) ||
      ((titleNorm.includes('screen') || titleNorm.includes('display')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace'))) ||
      (titleNorm.includes('software') && (titleNorm.includes('troubleshooting') || titleNorm.includes('error') || titleNorm.includes('crash') || titleNorm.includes('misconfig'))) ||
      (titleNorm.includes('virus') || titleNorm.includes('malware') || titleNorm.includes('spyware'));
    const inItCategory = categoryNorm.includes('laptop') || categoryNorm.includes('pc') || categoryNorm.includes('computer') || categoryNorm.includes('desktop') || categoryNorm.includes('laptop & pc repair & services') || categoryNorm.includes('it repair & services') || (categoryNorm.includes('home electronics') && (itKeyword || itSpecificHit));
    if (inItCategory || itKeyword || itSpecificHit) {
      if ((titleNorm.includes('battery') || titleNorm.includes('adapter')) && (titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Replacement of faulty laptop/PC batteries or adapters.';
        details.benefits = ['Ensures uninterrupted power supply', 'Proper device operation'];
        details.how = ['Faulty battery or adapter tested', 'Replaced with compatible unit'];
        details.who = ['Devices not charging or powering on.'];
      }
      if (titleNorm.includes('data') && (titleNorm.includes('backup') || titleNorm.includes('recovery'))) {
        details.purpose = 'Backup of data and recovery from corrupted or lost drives.';
        details.benefits = ['Prevents data loss', 'Ensures continuity'];
        details.how = ['Data retrieved from storage', 'Backed up or recovered using software/tools'];
        details.who = ['Users facing accidental deletion, system crash, or drive failure.'];
      }
      if ((titleNorm.includes('hard drive') || titleNorm.includes('hdd') || titleNorm.includes('ssd') || titleNorm.includes('ram')) && (titleNorm.includes('upgrade') || titleNorm.includes('upgradation'))) {
        details.purpose = 'Upgrading storage or memory for better performance.';
        details.benefits = ['Enhances speed', 'Increases capacity', 'Improves efficiency'];
        details.how = ['Old components replaced or expanded with higher capacity units'];
        details.who = ['Slow systems or storage-limited devices.'];
      }
      if ((titleNorm.includes('keyboard') || titleNorm.includes('touchpad')) && (titleNorm.includes('repair') || titleNorm.includes('replacement') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of faulty keyboards or touchpads.';
        details.benefits = ['Ensures smooth typing and navigation'];
        details.how = ['Components tested', 'Cleaned', 'Repaired or replaced'];
        details.who = ['Unresponsive or damaged keyboard/touchpad.'];
      }
      if ((titleNorm.includes('installation') || titleNorm.includes('setup')) && (titleNorm.includes('laptop') || titleNorm.includes('pc') || titleNorm.includes('computer') || titleNorm.includes('desktop'))) {
        details.purpose = 'Complete device setup for first-time use.';
        details.benefits = ['Ensures proper configuration', 'Optimized performance'];
        details.how = ['Hardware checked', 'OS installed', 'Essential drivers and software set up'];
        details.who = ['New devices or after reinstallation.'];
      }
      if (titleNorm.includes('network') || titleNorm.includes('connectivity') || titleNorm.includes('wi-fi') || titleNorm.includes('wifi') || titleNorm.includes('lan')) {
        details.purpose = 'Troubleshooting LAN, Wi‑Fi, or connectivity issues.';
        details.benefits = ['Ensures uninterrupted internet and network access'];
        details.how = ['Network settings diagnosed', 'Adapters/drivers fixed', 'Connectivity restored'];
        details.who = ['Devices unable to connect to network or slow internet issues.'];
      }
      if ((titleNorm.includes('os') || titleNorm.includes('operating system')) && (titleNorm.includes('installation') || titleNorm.includes('upgradation') || titleNorm.includes('upgrade'))) {
        details.purpose = 'Installing or upgrading operating systems.';
        details.benefits = ['Ensures security', 'Compatibility', 'Latest features'];
        details.how = ['OS installed/upgraded', 'Drivers configured', 'Device optimized'];
        details.who = ['Outdated OS or corrupt system issues.'];
      }
      if (titleNorm.includes('overheating') || (titleNorm.includes('fan') && titleNorm.includes('clean'))) {
        details.purpose = 'Cleaning device fans and heat sinks to prevent overheating.';
        details.benefits = ['Maintains performance', 'Prevents thermal damage'];
        details.how = ['Device opened', 'Fans/vents cleaned', 'Thermal paste checked/reapplied if needed'];
        details.who = ['Devices heating quickly or shutting down unexpectedly.'];
      }
      if ((titleNorm.includes('screen') || titleNorm.includes('display')) && (titleNorm.includes('replacement') || titleNorm.includes('repair') || titleNorm.includes('replace'))) {
        details.purpose = 'Repair or replacement of damaged screens and display issues.';
        details.benefits = ['Restores clear display', 'Improves usability'];
        details.how = ['Faulty panels replaced', 'Display connections tested'];
        details.who = ['Cracked screens, flickering, or dead pixels.'];
      }
      if (titleNorm.includes('software') || titleNorm.includes('app') || titleNorm.includes('application')) {
        if (titleNorm.includes('troubleshooting') || titleNorm.includes('error') || titleNorm.includes('crash') || titleNorm.includes('misconfig')) {
          details.purpose = 'Resolving software errors, crashes, or misconfigurations.';
          details.benefits = ['Ensures smooth system operation'];
          details.how = ['Software diagnosed', 'Repaired', 'Reinstalled or updated'];
          details.who = ['Users facing app or system errors.'];
        }
      }
      if (titleNorm.includes('virus') || titleNorm.includes('malware') || titleNorm.includes('spyware')) {
        details.purpose = 'Detecting and removing viruses, malware, or spyware.';
        details.benefits = ['Protects data', 'Improves device performance'];
        details.how = ['Scanning software used', 'Malicious files removed', 'System secured'];
        details.who = ['Devices infected or running slow due to malware.'];
      }
    }

    // Appliance Services - Gas Stove & Hob Services
    const inGasCategory = categoryNorm.includes('gas stove') || categoryNorm.includes('hob') || categoryNorm.includes('kitchen appliances');
    if (inGasCategory || (titleNorm.includes('gas') && (titleNorm.includes('stove') || titleNorm.includes('hob')))) {
      if (titleNorm.includes('auto') && titleNorm.includes('ignition')) {
        details.purpose = 'Fixes faulty auto-ignition for gas stoves and hobs.';
        details.uses = ['Spark module check', 'Wire & battery replacement', 'Ignition switch repair'];
        details.benefits = ['Ensures easy and safe ignition without matches/lighters'];
        details.how = ['Ignition system tested', 'Defective parts repaired or replaced'];
        details.who = ['Users facing delayed or no ignition in stoves/hobs.'];
      }
      if (titleNorm.includes('burner') && (titleNorm.includes('clean') || titleNorm.includes('polish'))) {
        details.purpose = 'Deep cleaning of clogged burners for smooth gas flow.';
        details.uses = ['Rust removal', 'Carbon cleaning', 'Polish for shine'];
        details.benefits = ['Restores strong flame', 'Improves gas efficiency'];
        details.how = ['Burners dismantled', 'Soaked', 'Cleaned', 'Polished', 'Refitted'];
        details.who = ['Anyone facing uneven or weak flame issues.'];
      }
      if ((titleNorm.includes('burner') && (titleNorm.includes('not ignit') || titleNorm.includes('low flame') || titleNorm.includes('adjust')))) {
        details.purpose = 'Adjustment and repair for weak or uneven burner flame.';
        details.uses = ['Gas flow regulation', 'Nozzle cleaning', 'Burner leveling'];
        details.benefits = ['Ensures consistent cooking flame and fuel efficiency'];
        details.how = ['Nozzle cleaned', 'Burner adjusted', 'Flame tested'];
        details.who = ['Households facing low flame or delayed ignition.'];
      }
      if (titleNorm.includes('gas') && titleNorm.includes('leak')) {
        details.purpose = 'Professional service to detect and fix gas leakages.';
        details.uses = ['Leak testing', 'Sealing joints', 'Regulator & pipe check'];
        details.benefits = ['Prevents fire hazards and ensures kitchen safety'];
        details.how = ['Leak test with solutions', 'Faulty parts repaired/replaced'];
        details.who = ['Homes with gas smell or suspected leakage.'];
      }
      if (titleNorm.includes('pipeline') || (titleNorm.includes('gas') && titleNorm.includes('inspection'))) {
        details.purpose = 'Thorough inspection of gas pipeline for safety.';
        details.uses = ['Joint tightening', 'Regulator check', 'Valve servicing'];
        details.benefits = ['Ensures long-term safety and prevents accidents'];
        details.how = ['Pipeline inspected end-to-end', 'Pressure checked', 'Leaks sealed'];
        details.who = ['Households using old gas pipelines or frequent leakage.'];
      }
      if ((titleNorm.includes('glass') && titleNorm.includes('top')) || titleNorm.includes('hob glass')) {
        details.purpose = 'Replacement of cracked or damaged hob glass tops.';
        details.uses = ['New toughened glass fitting', 'Frame alignment', 'Polishing'];
        details.benefits = ['Restores kitchen safety and aesthetic look'];
        details.how = ['Old glass removed', 'New one installed with secure fitting'];
        details.who = ['Families with cracked/damaged hob glass tops.'];
      }
      if (titleNorm.includes('knob') && (titleNorm.includes('repair') || titleNorm.includes('replacement'))) {
        details.purpose = 'Fixes or replaces faulty gas stove/hob knobs.';
        details.uses = ['Knob alignment', 'Spring check', 'New knob installation'];
        details.benefits = ['Smooth flame control and easy usability'];
        details.how = ['Damaged knobs removed', 'Replaced or repaired'];
        details.who = ['Anyone with jammed, broken, or loose knobs.'];
      }
      if (titleNorm.includes('preventive') || titleNorm.includes('maintenance')) {
        details.purpose = 'Regular maintenance service to prevent future issues.';
        details.uses = ['Burner cleaning', 'Knob check', 'Gas pipe inspection', 'Ignition test'];
        details.benefits = ['Ensures long life', 'Safety', 'Efficient cooking'];
        details.how = ['Complete stove/hob inspection', 'Cleaning', 'Adjustments'];
        details.who = ['Households wanting safe and trouble-free kitchen appliances.'];
      }
    }

    // AC Repair & Services
    const inAcCategory = categoryNorm.includes('ac repair') || categoryNorm.includes('ac services') || categoryNorm.includes('ac repair & services') || categoryNorm.includes('ac') || categoryNorm.includes('air conditioner');
    const acTitleHit =
      titleNorm.includes('installation & uninstallation') ||
      (titleNorm.includes('install') && titleNorm.includes('uninstall')) ||
      titleNorm.includes('not cooling') || titleNorm.includes('low cooling') ||
      titleNorm.includes('servicing') || titleNorm.includes('jet pump') || titleNorm.includes('wet') || titleNorm.includes('dry') ||
      titleNorm.includes('annual maintenance') || titleNorm.includes('amc') ||
      titleNorm.includes('compressor') || titleNorm.includes('fan motor') ||
      (titleNorm.includes('gas') && (titleNorm.includes('refill') || titleNorm.includes('refilling'))) ||
      titleNorm.includes('leak') || titleNorm.includes('leakage') || titleNorm.includes('lekage') ||
      titleNorm.includes('noise') ||
      titleNorm.includes('pcb') || titleNorm.includes('remote sensor') ||
      titleNorm.includes('water leak') || titleNorm.includes('water dripping') || titleNorm.includes('drip');
    if (inAcCategory || acTitleHit) {
      if ((titleNorm.includes('install') && titleNorm.includes('uninstall')) || titleNorm.includes('installation & uninstallation')) {
        details.purpose = 'Professional services for safe installation and removal of Split and Window AC units.';
        details.uses = [
          'Installation: Mounting indoor & outdoor units, copper piping, electrical connections, drainage setup, refrigerant check.',
          'Uninstallation: Gas recovery, dismantling indoor & outdoor units, disconnection of wiring & pipes.',
        ];
        details.benefits = [
          'Ensures proper cooling, energy efficiency, and safe operation during installation.',
          'Prevents refrigerant loss, protects AC parts, and ensures safe shifting during uninstallation.',
        ];
        details.how = [
          'Installation: Technicians securely install the AC, connect pipes/wiring, test gas levels, and check cooling performance.',
          'Uninstallation: AC gas is recovered properly, units carefully removed, and packed for transport.',
        ];
        details.who = ['Customers who bought a new AC, shifted to a new home/office, or replacing old units.'];
      }
      if (titleNorm.includes('not cooling') || titleNorm.includes('low cooling')) {
        details.purpose = 'Fixes cooling issues in ACs.';
        details.uses = ['Filter cleaning', 'Gas check', 'Coil inspection', 'Thermostat check'];
        details.benefits = ['Restores proper cooling and energy efficiency'];
        details.how = ['Fault diagnosed', 'Parts repaired/replaced', 'Cooling tested'];
        details.who = ['Customers facing poor or no cooling in AC.'];
      }
      if (titleNorm.includes('servicing') || titleNorm.includes('jet pump') || titleNorm.includes('wet') || titleNorm.includes('dry')) {
        details.purpose = 'Regular AC cleaning and servicing.';
        details.uses = ['Jet pump wash', 'Coil cleaning', 'Filter wash', 'Water drainage check'];
        details.benefits = ['Improves cooling', 'Prevents bad odor', 'Extends AC life'];
        details.how = ['Indoor/outdoor units cleaned thoroughly using machines'];
        details.who = ['Every AC user (recommended every 3–6 months).'];
      }
      if (titleNorm.includes('annual maintenance') || titleNorm.includes('amc')) {
        details.purpose = 'Yearly maintenance package for ACs.';
        details.uses = ['Multiple services', 'Priority support', 'Discounted repairs'];
        details.benefits = ['Hassle-free maintenance', 'Better performance', 'Cost savings'];
        details.how = ['Scheduled visits for servicing + emergency support'];
        details.who = ['Families, offices, and businesses with multiple ACs.'];
      }
      if (titleNorm.includes('compressor') || titleNorm.includes('fan motor')) {
        details.purpose = 'Repair/replacement of faulty AC compressors and fan motors.';
        details.uses = ['Motor rewinding', 'Compressor check', 'Part replacement'];
        details.benefits = ['Ensures smooth cooling', 'Prevents AC breakdown'];
        details.how = ['Motor/compressor tested', 'Faulty parts fixed/replaced'];
        details.who = ['Customers facing unusual AC noise or no cooling.'];
      }
      if ((titleNorm.includes('gas') && (titleNorm.includes('refill') || titleNorm.includes('refilling'))) || ((titleNorm.includes('leak') || titleNorm.includes('leakage') || titleNorm.includes('lekage')) && (titleNorm.includes('fix') || titleNorm.includes('repair')))) {
        details.purpose = 'Refilling of refrigerant gas and sealing of leaks.';
        details.uses = ['Leak detection', 'Sealing', 'Refrigerant refilling'];
        details.benefits = ['Restores cooling', 'Prevents energy loss'];
        details.how = ['AC pressure checked', 'Gas filled', 'Leaks sealed'];
        details.who = ['ACs showing low cooling or gas leakage.'];
      }
      if (titleNorm.includes('noise')) {
        details.purpose = 'Fixing unusual sounds from AC units.';
        details.uses = ['Fan blade alignment', 'Motor check', 'Loose part fixing'];
        details.benefits = ['Ensures silent and smooth cooling'];
        details.how = ['Noise source diagnosed', 'Faulty parts tightened or replaced'];
        details.who = ['AC users hearing rattling, humming, or buzzing noises.'];
      }
      if (titleNorm.includes('pcb') || titleNorm.includes('remote sensor')) {
        details.purpose = 'Repair or replacement of AC PCB boards and sensors.';
        details.uses = ['PCB testing', 'Component replacement', 'Remote sensor check'];
        details.benefits = ['Fixes electronic issues like no power, auto shut-off, remote not working'];
        details.how = ['PCB inspected', 'Repaired, or replaced with new parts'];
        details.who = ['AC owners facing electronic failures.'];
      }
      if (titleNorm.includes('water leak') || titleNorm.includes('water leakage') || titleNorm.includes('water lekage') || (titleNorm.includes('water') && titleNorm.includes('drip'))) {
        details.purpose = 'Fixes water dripping/leakage from AC units.';
        details.uses = ['Drain pipe cleaning', 'Coil cleaning', 'Insulation check'];
        details.benefits = ['Prevents wall damage', 'Mold growth', 'AC inefficiency'];
        details.how = ['Drain blockages cleared', 'Pipe fixed', 'Insulation repaired'];
        details.who = ['AC users facing indoor water dripping issues.'];
      }
    }

    // Personal & Trip-based Services (Drivers)
    if (titleNorm.includes('driver') && (titleNorm.includes('corporate') || titleNorm.includes('executive'))) {
      details.purpose = 'Professional drivers available for corporate staff and executives.';
      details.uses = ['Trained uniformed drivers', 'Punctual service', 'Safe driving'];
      details.benefits = ['Ideal for office commute', 'Corporate events', 'Official travel'];
      details.how = ['Drivers are assigned as per company schedule and route'];
      details.who = ['Companies, business professionals, and corporate staff.'];
    }

    if ((titleNorm.includes('hourly') && titleNorm.includes('driver')) || titleNorm.includes('driver hire')) {
      details.purpose = 'Hire a driver on an hourly basis for short trips or errands.';
      details.uses = ['Flexible hourly slots', 'Pick-up & drop convenience'];
      details.benefits = ['Cost-effective for local travel', 'Useful for shopping or hospital visits'];
      details.how = ['Driver assigned for chosen duration', 'Charges based on time used'];
      details.who = ['Individuals needing temporary local driving support.'];
    }

    if (titleNorm.includes('long') && (titleNorm.includes('distance') || titleNorm.includes('outstation')) && titleNorm.includes('driver')) {
      details.purpose = 'Drivers for outstation and long-distance travel.';
      details.uses = ['Experienced highway drivers', 'Overnight travel support'];
      details.benefits = ['Reduces fatigue', 'Ensures safe long trips'];
      details.how = ['Driver accompanies for intercity or interstate journeys'];
      details.who = ['Families, professionals, or travelers planning long road trips.'];
    }

    if ((titleNorm.includes('pick-up') || titleNorm.includes('pickup') || titleNorm.includes('pick up')) && titleNorm.includes('drop') && titleNorm.includes('driver')) {
      details.purpose = 'Driver-only service for taking your car to a destination.';
      details.uses = ['Home-to-office drop', 'Airport transfers', 'Party pick-up & drop'];
      details.benefits = ['Ensures safe and hassle-free travel when you can’t drive'];
      details.how = ['Driver drives your car from pick-up to drop location'];
      details.who = ['People with busy schedules or after-event safe travel needs.'];
    }

    if ((titleNorm.includes('temporary') || titleNorm.includes('one-time') || titleNorm.includes('one time')) && titleNorm.includes('driver')) {
      details.purpose = 'Drivers available on demand for one-time or short-term trips.';
      details.uses = ['City tour', 'Weekend getaway', 'Day-long driving'];
      details.benefits = ['Convenient when you don’t want to drive yourself'];
      details.how = ['Driver booked for specific trip duration and route'];
      details.who = ['Families, tourists, or occasional travelers.'];
    }

    // Tires & Wheels - Bike
    const hasTyreWord = titleNorm.includes('tyre') || titleNorm.includes('tire');
    if (((titleNorm.includes('bike') || titleNorm.includes('motorcycle')) || categoryNorm.includes('bike tires') || categoryNorm.includes('bike tyres') || categoryNorm.includes('bike tires & wheels') || categoryNorm.includes('bike tyres & wheels')) && hasTyreWord && (titleNorm.includes('new') || titleNorm.includes('installation') || titleNorm.includes('install'))) {
      details.purpose = 'Professional fitting of new bike tires.';
      details.uses = ['Old tire removal', 'New tire mounting', 'Air pressure check'];
      details.benefits = ['Ensures safe rides', 'Better grip', 'Improves mileage'];
      details.how = ['Old tires removed', 'New ones installed with balancing'];
      details.who = ['Riders with worn-out, puncture-prone, or old tires.'];
    }

    if ((titleNorm.includes('puncture') || titleNorm.includes('flat')) && (titleNorm.includes('bike') || titleNorm.includes('motorcycle') || hasTyreWord)) {
      details.purpose = 'Quick and reliable puncture fixing for bike tires.';
      details.uses = ['Tube/tubeless puncture repair', 'Patching', 'Air filling'];
      details.benefits = ['Saves time', 'Avoids replacement costs', 'Ensures safety'];
      details.how = ['Puncture located', 'Repaired using standard plugs/patches'];
      details.who = ['Riders facing sudden flat tires or air leaks.'];
    }

    if ((titleNorm.includes('wheel') && (titleNorm.includes('balancing') || titleNorm.includes('alignment'))) && (titleNorm.includes('bike') || titleNorm.includes('motorcycle'))) {
      details.purpose = 'Balances wheels and aligns them for smooth rides.';
      details.uses = ['Tire balancing', 'Chain alignment', 'Fork alignment check'];
      details.benefits = ['Prevents uneven wear', 'Improves stability and mileage'];
      details.how = ['Specialized machines used for precise balancing & alignment'];
      details.who = ['Riders noticing vibrations, wobbling, or uneven wear.'];
    }

    // Tires & Wheels - Car
    if (titleNorm.includes('alloy') && titleNorm.includes('wheel') && (titleNorm.includes('restoration') || titleNorm.includes('repair'))) {
      details.purpose = 'Repairs scratches, bends, or cracks in alloy wheels.';
      details.uses = ['Sanding', 'Repainting', 'Polishing', 'Dent correction'];
      details.benefits = ['Improves looks', 'Ensures safe wheel performance'];
      details.how = ['Damaged alloys are repaired', 'Repainted', 'Polished'];
      details.who = ['Car owners with scratched or bent alloy wheels.'];
    }

    if (hasTyreWord && (titleNorm.includes('new') || titleNorm.includes('installation') || titleNorm.includes('install')) && (titleNorm.includes('car') || categoryNorm.includes('car tyres') || categoryNorm.includes('car tires') || categoryNorm.includes('car tyres & wheels') || categoryNorm.includes('car tires & wheels'))) {
      details.purpose = 'Replacement and fitting of new car tires.';
      details.uses = ['Tire mounting', 'Balancing', 'Valve check', 'Air filling'];
      details.benefits = ['Ensures road safety', 'Better grip', 'Smooth driving'];
      details.how = ['Old tires removed', 'New ones fitted with wheel balancing'];
      details.who = ['Owners with worn-out or old tires.'];
    }

    if ((titleNorm.includes('puncture') || titleNorm.includes('flat')) && (titleNorm.includes('car') || hasTyreWord)) {
      details.purpose = 'Quick puncture repair service for tubeless & tube tires.';
      details.uses = ['Plug repair', 'Patching', 'Air filling'];
      details.benefits = ['Saves cost of replacement', 'Ensures safe travel'];
      details.how = ['Puncture point identified', 'Repaired with professional tools'];
      details.who = ['Drivers facing sudden flat tire or air leakage.'];
    }

    if (titleNorm.includes('wheel') && titleNorm.includes('alignment') && !titleNorm.includes('bike') && !titleNorm.includes('motorcycle')) {
      details.purpose = 'Adjusts wheel angles for smooth handling and better mileage.';
      details.uses = ['Toe', 'Camber', 'Caster adjustments'];
      details.benefits = ['Prevents uneven tire wear', 'Improves control and fuel efficiency'];
      details.how = ['Alignment done using computerized machines'];
      details.who = ['Drivers noticing car pulling to one side or uneven tire wear.'];
    }

    return details;
  }, [chosenProduct?.title]);

  if (!chosenProduct) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Not Found</Text>
        <Text style={styles.notFoundText}>We could not find this service.</Text>
        <TouchableOpacity
          onPress={() => {
            hapticButtonPress();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onAddToCart = () => {
    hapticButtonPress();
    setShowBooking(true);
  };

  const onConfirmBooking = (date: string, time: string) => {
    addToCart({
      id: String(chosenProduct!.id),
      title: chosenProduct!.title,
      description: chosenProduct!.description,
      price: chosenProduct!.price,
      time: chosenProduct!.time,
      image: chosenProduct!.image,
      category: chosenProduct!.category,
      bookingDate: date,
      bookingTime: time,
    });
    hapticSuccess();
    setToastMessage('Service added to cart successfully!');
    setShowToast(true);
    setShowBooking(false);
  };


  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Floating Back Button */}
        <TouchableOpacity 
          onPress={() => {
            hapticButtonPress();
            router.back();
          }} 
          style={styles.floatingBackBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>

        {/* Hero Image */}
        <View style={styles.imageContainer}>
      <Image source={chosenProduct!.image} style={styles.image} />
        </View>

        {/* Content */}
      <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: colors.text }]}>{chosenProduct!.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={[styles.rating, { color: colors.textSecondary }]}>{formatRating(chosenProduct?.rating)}</Text>
              </View>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.time, { color: colors.textSecondary }]}>{chosenProduct!.time}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>{chosenProduct!.description}</Text>

          {/* Enhanced Info Cards */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.infoTitle, { color: colors.text }]}>Why choose this service</Text>
            </View>
          <View style={styles.bulletItem}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Verified professionals with background checks</Text>
          </View>
          <View style={styles.bulletItem}>
              <Ionicons name="card-outline" size={16} color="#10B981" />
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Standard pricing and no hidden charges</Text>
          </View>
          <View style={styles.bulletItem}>
              <Ionicons name="construct-outline" size={16} color="#10B981" />
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Quality tools, materials and service warranty</Text>
          </View>
        </View>

          {/* Structured automobile details */}
          {!!structuredDetails.purpose && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.text }]}>Purpose</Text>
              </View>
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{structuredDetails.purpose}</Text>
            </View>
          )}

          {structuredDetails.uses && structuredDetails.uses.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="apps-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.text }]}>Uses</Text>
              </View>
              {structuredDetails.uses.map((u, i) => (
                <View key={`uses-${i}`} style={styles.bulletItem}>
                  <Ionicons name="ellipse" size={8} color={colors.textSecondary} />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{u}</Text>
                </View>
              ))}
            </View>
          )}

          {structuredDetails.benefits && structuredDetails.benefits.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="thumbs-up-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.text }]}>Key Benefits</Text>
              </View>
              {structuredDetails.benefits.map((b, i) => (
                <View key={`benefits-${i}`} style={styles.bulletItem}>
                  <Ionicons name="ellipse" size={8} color={colors.textSecondary} />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {structuredDetails.who && structuredDetails.who.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.text }]}>Who Should Take</Text>
              </View>
              {structuredDetails.who.map((w, i) => (
                <View key={`who-${i}`} style={styles.bulletItem}>
                  <Ionicons name="ellipse" size={8} color={colors.textSecondary} />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {structuredDetails.how && structuredDetails.how.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="reader-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.text }]}>How It Works</Text>
              </View>
              {structuredDetails.how.map((h, i) => (
                <View key={`how-${i}`} style={styles.bulletItem}>
                  <Ionicons name="ellipse" size={8} color={colors.textSecondary} />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{h}</Text>
          </View>
              ))}
          </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.priceSection}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Starting from</Text>
          <Text style={[styles.price, { color: colors.text }]}>{chosenProduct!.price}</Text>
        </View>
        <LinearGradient
          colors={[colors.secondary, colors.secondaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.addButton}
        >
          <TouchableOpacity 
            style={styles.addButtonInner} 
            onPress={onAddToCart} 
            activeOpacity={0.9}
          >
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && (
        <LinearGradient
          colors={[colors.secondary, colors.secondaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.floatingCartButton}
        >
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/cart')} 
            activeOpacity={0.8} 
            style={styles.floatingCartInner}
          >
            <Ionicons name="cart" size={24} color="#FFFFFF" />
            {getTotalItems() > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cartBadgeText, { color: colors.primary }]}>{getTotalItems()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>
      )}

      <DateTimePicker
        visible={showBooking}
        onClose={() => setShowBooking(false)}
        onConfirm={onConfirmBooking}
        serviceTitle={chosenProduct!.title}
      />

      <Toast 
        visible={showToast} 
        message={toastMessage} 
        type="success" 
        onHide={() => setShowToast(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    paddingBottom: 100,
  },
  floatingBackBtn: {
    position: 'absolute',
    top: 50,
    left: 15,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  imageContainer: {
    position: 'relative',
    height: 280,
  },
  image: {
    width: '100%',
    height: '100%',
      resizeMode: 'cover',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  includedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  includedText: {
    fontSize: 14,
    flex: 1,
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reviewSummary: {
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewRating: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewCount: {
    fontSize: 14,
  },
  viewAllReviews: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
  },
  addButton: {
    borderRadius: 12,
    marginLeft: 16,
  },
  addButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  floatingCartInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cartBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  notFoundText: {
    color: '#6B7280',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
});