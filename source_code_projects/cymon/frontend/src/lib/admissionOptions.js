// Shared dropdown options for the Student Admission form (create + edit).
// Lists stay in one place so both forms never drift apart.

export const OTHER_VALUE = '__OTHER__'

// Philippine provinces + Metro Manila. Free-text cities stay supported via
// the "Others (specify)" branch so old records with "Quezon City" etc. load
// as Others + custom text instead of breaking.
export const PH_BIRTH_PLACES = [
  'Abra',
  'Agusan del Norte',
  'Agusan del Sur',
  'Aklan',
  'Albay',
  'Antique',
  'Apayao',
  'Aurora',
  'Basilan',
  'Bataan',
  'Batanes',
  'Batangas',
  'Benguet',
  'Biliran',
  'Bohol',
  'Bukidnon',
  'Bulacan',
  'Cagayan',
  'Camarines Norte',
  'Camarines Sur',
  'Camiguin',
  'Capiz',
  'Catanduanes',
  'Cavite',
  'Cebu',
  'Cotabato',
  'Davao de Oro',
  'Davao del Norte',
  'Davao del Sur',
  'Davao Occidental',
  'Davao Oriental',
  'Dinagat Islands',
  'Eastern Samar',
  'Guimaras',
  'Ifugao',
  'Ilocos Norte',
  'Ilocos Sur',
  'Iloilo',
  'Isabela',
  'Kalinga',
  'La Union',
  'Laguna',
  'Lanao del Norte',
  'Lanao del Sur',
  'Leyte',
  'Maguindanao del Norte',
  'Maguindanao del Sur',
  'Marinduque',
  'Masbate',
  'Metro Manila (NCR)',
  'Misamis Occidental',
  'Misamis Oriental',
  'Mountain Province',
  'Negros Occidental',
  'Negros Oriental',
  'Northern Samar',
  'Nueva Ecija',
  'Nueva Vizcaya',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Palawan',
  'Pampanga',
  'Pangasinan',
  'Quezon',
  'Quirino',
  'Rizal',
  'Romblon',
  'Samar',
  'Sarangani',
  'Siquijor',
  'Sorsogon',
  'South Cotabato',
  'Southern Leyte',
  'Sultan Kudarat',
  'Sulu',
  'Surigao del Norte',
  'Surigao del Sur',
  'Tarlac',
  'Tawi-Tawi',
  'Zambales',
  'Zamboanga del Norte',
  'Zamboanga del Sur',
  'Zamboanga Sibugay',
]

export const EMERGENCY_RELATIONS = [
  'Mother',
  'Father',
]

// Component / highly-urbanized cities per province for the birthplace city
// step (e.g. Laguna → Cabuyao City). Towns and municipalities that are not
// listed use the "Others (specify)" branch so any birthplace stays valid.
export const PH_PROVINCE_CITIES = {
  'Abra': [],
  'Agusan del Norte': ['Butuan City', 'Cabadbaran City'],
  'Agusan del Sur': ['Bayugan City'],
  'Aklan': [],
  'Albay': ['Legazpi City', 'Ligao City', 'Tabaco City'],
  'Antique': [],
  'Apayao': [],
  'Aurora': [],
  'Basilan': ['Isabela City', 'Lamitan City'],
  'Bataan': ['Balanga City'],
  'Batanes': [],
  'Batangas': ['Batangas City', 'Calaca City', 'Lipa City', 'Santo Tomas City', 'Tanauan City'],
  'Benguet': ['Baguio City'],
  'Biliran': [],
  'Bohol': ['Tagbilaran City'],
  'Bukidnon': ['Malaybalay City', 'Valencia City'],
  'Bulacan': ['Malolos City', 'Meycauayan City', 'San Jose del Monte City'],
  'Cagayan': ['Tuguegarao City'],
  'Camarines Norte': [],
  'Camarines Sur': ['Iriga City', 'Naga City'],
  'Camiguin': [],
  'Capiz': ['Roxas City'],
  'Catanduanes': [],
  'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'General Trias City', 'Imus City', 'Tagaytay City', 'Trece Martires City'],
  'Cebu': ['Bogo City', 'Carcar City', 'Cebu City', 'Danao City', 'Lapu-Lapu City', 'Mandaue City', 'Naga City', 'Talisay City', 'Toledo City'],
  'Cotabato': ['Kidapawan City'],
  'Davao de Oro': [],
  'Davao del Norte': ['Panabo City', 'Samal City', 'Tagum City'],
  'Davao del Sur': ['Davao City', 'Digos City'],
  'Davao Occidental': [],
  'Davao Oriental': ['Mati City'],
  'Dinagat Islands': [],
  'Eastern Samar': ['Borongan City'],
  'Guimaras': [],
  'Ifugao': [],
  'Ilocos Norte': ['Batac City', 'Laoag City'],
  'Ilocos Sur': ['Candon City', 'Vigan City'],
  'Iloilo': ['Iloilo City', 'Passi City'],
  'Isabela': ['Cauayan City', 'Ilagan City', 'Santiago City'],
  'Kalinga': ['Tabuk City'],
  'La Union': ['San Fernando City'],
  'Laguna': ['Biñan City', 'Cabuyao City', 'Calamba City', 'San Pablo City', 'San Pedro City', 'Santa Rosa City'],
  'Lanao del Norte': ['Iligan City'],
  'Lanao del Sur': ['Marawi City'],
  'Leyte': ['Baybay City', 'Ormoc City', 'Tacloban City'],
  'Maguindanao del Norte': [],
  'Maguindanao del Sur': [],
  'Marinduque': [],
  'Masbate': ['Masbate City'],
  'Metro Manila (NCR)': ['Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila', 'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela'],
  'Misamis Occidental': ['Oroquieta City', 'Ozamiz City', 'Tangub City'],
  'Misamis Oriental': ['Cagayan de Oro City', 'El Salvador City', 'Gingoog City'],
  'Mountain Province': [],
  'Negros Occidental': ['Bacolod City', 'Bago City', 'Cadiz City', 'Escalante City', 'Himamaylan City', 'Kabankalan City', 'La Carlota City', 'Sagay City', 'San Carlos City', 'Silay City', 'Sipalay City', 'Talisay City', 'Victorias City'],
  'Negros Oriental': ['Bais City', 'Bayawan City', 'Canlaon City', 'Dumaguete City', 'Guihulngan City', 'Tanjay City'],
  'Northern Samar': [],
  'Nueva Ecija': ['Cabanatuan City', 'Gapan City', 'Muñoz City', 'Palayan City', 'San Jose City'],
  'Nueva Vizcaya': [],
  'Occidental Mindoro': [],
  'Oriental Mindoro': ['Calapan City'],
  'Palawan': ['Puerto Princesa City'],
  'Pampanga': ['Angeles City', 'Mabalacat City', 'San Fernando City'],
  'Pangasinan': ['Alaminos City', 'Dagupan City', 'San Carlos City', 'Urdaneta City'],
  'Quezon': ['Lucena City', 'Tayabas City'],
  'Quirino': [],
  'Rizal': ['Antipolo City'],
  'Romblon': [],
  'Samar': ['Calbayog City', 'Catbalogan City'],
  'Sarangani': [],
  'Siquijor': [],
  'Sorsogon': ['Sorsogon City'],
  'South Cotabato': ['General Santos City', 'Koronadal City'],
  'Southern Leyte': ['Maasin City'],
  'Sultan Kudarat': ['Tacurong City'],
  'Sulu': [],
  'Surigao del Norte': ['Surigao City'],
  'Surigao del Sur': ['Bislig City', 'Tandag City'],
  'Tarlac': ['Tarlac City'],
  'Tawi-Tawi': [],
  'Zambales': ['Olongapo City'],
  'Zamboanga del Norte': ['Dapitan City', 'Dipolog City'],
  'Zamboanga del Sur': ['Pagadian City', 'Zamboanga City'],
  'Zamboanga Sibugay': [],
}

export const CITIZENSHIPS = [
  'Filipino',
  'Dual Citizen',
  'American',
  'Chinese',
  'Korean',
  'Japanese',
  'Indian',
  'Australian',
  'British',
  'Canadian',
]

export const RELIGIONS = [
  'Roman Catholic',
  'Islam',
  'Evangelical',
  'Iglesia ni Cristo',
  'Seventh-day Adventist',
  'Born Again Christian',
  'Protestant',
  "Jehovah's Witness",
  'Church of Jesus Christ of Latter-day Saints',
  'Philippine Independent Church (Aglipayan)',
  'United Church of Christ in the Philippines',
  'Buddhism',
  'None / No religion',
]

// Split a saved free-text DB value into { select, other } so old records
// with custom values (e.g. "Quezon City") load as Others + prefilled text.
export const splitOption = (list, value) => {
  if (!value) return { select: '', other: '' }
  if (list.includes(value)) return { select: value, other: '' }
  return { select: OTHER_VALUE, other: value }
}

// Resolve the final string to save: option, or the Others free text.
export const finalOption = (select, other) =>
  select === OTHER_VALUE ? (other || '').trim() : (select || '').trim()

// Split a saved "City, Province" (or legacy plain-province) birthplace value
// into province + city parts so old records keep loading correctly.
export const splitBirthplace = (value) => {
  const blank = { province: '', provinceOther: '', city: '', cityOther: '' }
  if (!value) return blank
  const trimmed = String(value).trim()
  const comma = trimmed.lastIndexOf(',')
  if (comma > -1) {
    const left = trimmed.slice(0, comma).trim()
    const right = trimmed.slice(comma + 1).trim()
    if (PH_BIRTH_PLACES.includes(right)) {
      const cities = PH_PROVINCE_CITIES[right] || []
      if (cities.includes(left)) return { province: right, provinceOther: '', city: left, cityOther: '' }
      return { province: right, provinceOther: '', city: OTHER_VALUE, cityOther: left }
    }
  }
  if (PH_BIRTH_PLACES.includes(trimmed)) return { ...blank, province: trimmed }
  return { ...blank, province: OTHER_VALUE, provinceOther: trimmed }
}

// Resolve the final birthplace string to save: "City, Province",
// province only when no city was given, or the Others free text.
export const finalBirthplace = (province, provinceOther, city, cityOther) => {
  const prov = finalOption(province, provinceOther)
  const c = city === OTHER_VALUE ? (cityOther || '').trim() : (city || '').trim()
  if (c && prov) return `${c}, ${prov}`
  return c || prov
}
