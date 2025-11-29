import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fieldUpdates = [
  {
    fieldName: 'submissionId',
    businessDescription: 'Internal unique identifier assigned to this submission inside Auxos. Represents the system-generated ID used for tracking and referencing this specific submission instance. Not derived from the content of any document or email.',
    extractorLogic: 'Do not extract from any document or email. Always generate a new unique ID programmatically at the time the submission is received. Never attempt to parse or infer this value from any provided text or attachment.',
    whereToLook: 'Generated',
  },
  {
    fieldName: 'carrierName',
    businessDescription: 'The name of the insurance carrier receiving, reviewing, or referenced in the submission. This may be mentioned by brokers submitting the risk or implied by the sender\'s organization. Also referred to as insurer or carrier company name.',
    extractorLogic: 'Search the email body for explicit carrier mentions such as "Submitting to…", "Please review for…", or "Quote with…". Inspect the email signature for company names or carrier-associated email domains. Review ACORD headers or form titles where carrier names sometimes appear. Normalize to a standard carrier name when possible.',
    whereToLook: 'Email body, email signature, ACORD header',
  },
  {
    fieldName: 'brokerName',
    businessDescription: 'The full name of the broker, producer, or agent submitting the risk. May refer to either the individual broker or the brokerage entity depending on what is provided.',
    extractorLogic: 'Extract the sender\'s name from the email signature when available. Identify personal names paired with titles such as Producer, Broker, or Account Manager. If an individual name is not present, infer the brokerage name from the sender\'s email domain or the agency listed in the ACORD Producer section.',
    whereToLook: 'Email signature, ACORD Producer section',
  },
  {
    fieldName: 'brokerEmail',
    businessDescription: 'The email address of the broker or producer submitting the submission. Identifies the primary contact for the submission.',
    extractorLogic: 'First, check the EMAIL METADATA section for the "From" field - this is the primary source. If the email has been forwarded, the From field may show the forwarder, so also check the email body for the original sender\'s email address. Look in email signatures for email addresses (often after the broker name or in contact blocks). Search the entire email body for any email addresses that match the broker\'s name or company. Validate that the extracted value matches a standard email format (contains @ symbol and domain).',
    whereToLook: 'Email metadata (From field), email body signature',
  },
  {
    fieldName: 'brokerPhone',
    businessDescription: 'Phone number for the submitting broker or producer, used for underwriting follow-up. May include office line, direct line, or mobile.',
    extractorLogic: 'Search the ENTIRE email body thoroughly, especially the signature section at the bottom. Look for phone number patterns: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX, or (XXX)XXX-XXXX. Check for labels like Phone, Office, Direct, Cell, Mobile, P:, Tel, or T:. Also search narrative text - phone numbers are sometimes mentioned in context. On ACORD forms, refer to the Producer Information section. Normalize the phone number format. Prefer direct lines over general office numbers when multiple are present. IMPORTANT: Even if not explicitly labeled, extract any phone number found in the email signature or body.',
    whereToLook: 'Email body (especially signature), ACORD Producer section',
  },
  {
    fieldName: 'namedInsured',
    businessDescription: 'The legal entity name of the business that is being insured. Represents the applicant or organization seeking coverage.',
    extractorLogic: 'Extract from the Named Insured or Applicant fields on ACORD 125 or 140. Use SOV headers or loss run headers if present. In the email body, look for phrases like "Named Insured:" or "Applicant:". Prefer legal entity names over DBAs when both are provided.',
    whereToLook: 'ACORD 125, ACORD 140, SOV header, email body',
  },
  {
    fieldName: 'mailingAddress',
    businessDescription: 'The primary mailing address of the insured business. Represents the official correspondence address for the applicant.',
    extractorLogic: 'First, check ACORD forms for the Mailing Address field in Applicant Information section. If not in ACORD, search the ENTIRE email body thoroughly. Look for address patterns: street numbers (e.g., "123 Main St"), city names, state abbreviations (WA, CA, etc.), and ZIP codes (5 digits). Addresses may appear in narrative text (e.g., "plant in Tacoma, WA" or "located at 4100 Marine View Drive, Tacoma, WA 98422"). They may also be in signature blocks or mentioned when describing locations. Combine street, city, state, and ZIP into a complete address. Choose the address explicitly labeled as Mailing or Primary when multiple addresses appear, otherwise use the most complete address found.',
    whereToLook: 'ACORD forms, email body (entire body including narrative)',
  },
  {
    fieldName: 'naicsCode',
    businessDescription: 'Six-digit NAICS industry classification describing the insured\'s primary type of business operation.',
    extractorLogic: 'Search ACORD forms for the NAICS field. In the email body, look for labeled numeric codes such as NAICS or Industry Code. Validate that the value is a six-digit number within valid NAICS ranges. Ignore partial or descriptive text.',
    whereToLook: 'ACORD, email narrative',
  },
  {
    fieldName: 'operationsDescription',
    businessDescription: 'A free-form narrative explaining what the business does operationally. Describes the nature and scope of operations for underwriting evaluation.',
    extractorLogic: 'Extract paragraphs in the email that describe the business\'s activities. Review ACORD Remarks and Supplemental sections for operational summaries. Preserve full descriptive sentences and remove placeholder text such as "See attached."',
    whereToLook: 'Email body, ACORD remarks',
  },
  {
    fieldName: 'submissionType',
    businessDescription: 'Indicates whether the submission is a new business submission, renewal, endorsement, rewrite, or other transaction type.',
    extractorLogic: 'Scan the email subject and body for keywords such as New, Renewal, Endorsement, Rewrite, or Remarketing. If no clear indicator is present, default to New. Interpret broker shorthand (e.g., "renl", "NB") when found.',
    whereToLook: 'Email subject, email body',
  },
  {
    fieldName: 'effectiveDate',
    businessDescription: 'The proposed start date of the insurance coverage or policy period. Defines when coverage is intended to begin.',
    extractorLogic: 'Extract from the Proposed Effective Date field on ACORD forms. Search for date expressions in the email body that follow phrases like Effective, Inception, or Coverage begins. Accept standard date formats and ignore unrelated dates such as email timestamps.',
    whereToLook: 'ACORD, email narrative',
  },
  {
    fieldName: 'expirationDate',
    businessDescription: 'The proposed end date of the policy period. Represents when the coverage is intended to terminate.',
    extractorLogic: 'Extract from the Expiration Date field in ACORD forms. Search email text for phrases such as Expires, Expiration, or Through. Validate that the expiration date is later than the effective date when both are available.',
    whereToLook: 'ACORD, email narrative',
  },
  {
    fieldName: 'priorCarrier',
    businessDescription: 'The insurer currently or most recently providing coverage to the insured. Indicates incumbent or expiring coverage.',
    extractorLogic: 'Search the email body for phrases like Currently with, Expiring with, or Prior carrier. Extract carrier names from loss run headers. Review ACORD Prior Coverage sections. Normalize carrier names using known variations.',
    whereToLook: 'Email narrative, loss runs, ACORD',
  },
  {
    fieldName: 'priorPolicyNumber',
    businessDescription: 'The policy number of the insured\'s existing or expiring policy.',
    extractorLogic: 'Extract from ACORD prior coverage fields or loss run headers where policy numbers appear prominently. Search the email for phrases such as Expiring policy number. Accept alphanumeric formats including dashes and slashes.',
    whereToLook: 'ACORD, loss runs',
  },
  // LOCATIONS & BUILDINGS
  {
    fieldName: 'locationNumber',
    businessDescription: 'Numeric identifier used to distinguish each physical location on an ACORD form or SOV. Represents a unique premises or site. May also appear as Loc #, Location #, Premises #, or simply "Loc".',
    extractorLogic: 'Search for numeric values labeled Location #, Loc #, Prem #, Premises #, or Location Number. In SOV spreadsheets, extract from columns named Location, Loc, or Location #. In ACORD PDFs, check the Scheduled Locations section. Ensure you return the location index exactly as presented, typically an integer. Avoid confusing with Building Number.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'buildingNumber',
    businessDescription: 'Numeric identifier for each building at a location. Used to distinguish multiple structures at the same location.',
    extractorLogic: 'Search for numeric values labeled Building #, Bldg #, Bldg No, or Structure #. In SOV spreadsheets, extract from columns named Building, Bldg, or Building #. Group buildings by their associated Location Number. Ensure you return the building index exactly as presented, typically an integer.',
    whereToLook: 'SOV, ACORD supplemental, schedule attachments',
  },
  // COVERAGE & LIMITS
  {
    fieldName: 'policyType',
    businessDescription: 'Describes the type of policy requested or quoted, such as Property, Package, BOP, Commercial Property, or CPP. Indicates overall coverage structure.',
    extractorLogic: 'Search the email body or ACORD forms for labels such as Policy Type, Type of Policy, BOP, CPP, Property, Package Policy, or Commercial Property. Look for acronyms like BPP (business personal property), BI/EE (business income/extra expense), or CP forms that imply policy type. Select the main policy classification stated.',
    whereToLook: 'Email body, ACORD, quote sheets',
  },
  {
    fieldName: 'causeOfLossForm',
    businessDescription: 'Indicates the hazard form: Basic, Broad, or Special. Defines which perils the property policy covers.',
    extractorLogic: 'Search for Basic, Broad, Special, COL, Cause of Loss, or Form CP 10 10 (Basic), CP 10 20 (Broad), or CP 10 30 (Special). Extract the specific word Basic, Broad, or Special if present. Avoid confusing with coverage options unrelated to perils.',
    whereToLook: 'ACORD, email, quote sheets, proposals',
  },
  {
    fieldName: 'coinsurancePercent',
    businessDescription: 'The coinsurance percentage applied to property coverage, typically 80%, 90%, or 100%. Represents the required minimum insured value.',
    extractorLogic: 'Extract numeric percentages labeled Coinsurance, Co-Ins, COINS, CIS, or CO-INS %. Look for "80% Coinsurance", "90% Co-Ins", or "Coinsurance: 100%". Return the numeric percent without the % symbol if needed.',
    whereToLook: 'ACORD, quote sheets, email narrative',
  },
  {
    fieldName: 'valuationMethod',
    businessDescription: 'The valuation basis used for settlement: Replacement Cost (RC), Actual Cash Value (ACV), or sometimes Functional Replacement Cost (FRC).',
    extractorLogic: 'Search for RC, ACV, RCV, Replacement Cost, Actual Cash Value, Functional RC, or FRC. If multiple appear, choose the valuation listed for the building coverage specifically. Avoid confusing with depreciation terms elsewhere in documents.',
    whereToLook: 'ACORD, quote sheets, proposals, email',
  },
  {
    fieldName: 'buildingLimit',
    businessDescription: 'The insurance limit assigned to Building coverage for each insured structure. Represents the property value covered.',
    extractorLogic: 'Extract currency values labeled Building Limit, BLDG Limit, Limit – Building, Coverage A Building, or BLDG. In SOV rows, use columns such as Building Value, Building TIV, or Bldg Limit. Normalize by removing commas and currency symbols.',
    whereToLook: 'SOV, ACORD, quote sheets',
  },
  {
    fieldName: 'businessPersonalPropertyLimit',
    businessDescription: 'The limit applicable to Business Personal Property (BPP). Covers movable property, equipment, stock, etc.',
    extractorLogic: 'Extract labeled values such as BPP Limit, Contents Limit, Personal Property Limit, Coverage B, or CPP BPP. In SOV, look for columns titled BPP, Contents, or Personal Property. Return the numeric value.',
    whereToLook: 'SOV, ACORD, quote sheets',
  },
  {
    fieldName: 'businessIncomeLimit',
    businessDescription: 'Limit or value for Business Income and Extra Expense (BI/EE). Represents loss of income coverage.',
    extractorLogic: 'Search for BI Limit, Business Income, Extra Expense, BI/EE, Time Element, TE, or ALS (Actual Loss Sustained) when no numeric limit is provided. If ALS appears with no amount, output "ALS".',
    whereToLook: 'SOV, ACORD, proposals, email',
  },
  {
    fieldName: 'deductibleAllPeril',
    businessDescription: 'The standard property deductible applied to most covered perils. Usually a flat dollar amount.',
    extractorLogic: 'Search for All Peril Deductible, Property Deductible, AP Ded, or simply Deductible when context indicates the base deductible. Extract numeric value. Ignore separate Wind/Hail or Named Storm deductibles.',
    whereToLook: 'ACORD, proposals, quote sheets',
  },
  {
    fieldName: 'windHailDeductible',
    businessDescription: 'Special deductible for Wind or Hail events, often different from the All Peril deductible. May be flat or a percentage.',
    extractorLogic: 'Search for Wind/Hail Deductible, Wind Ded, WH Deductible, Hail Deductible, Wind %, Named Storm %, Hurricane %, or Wind/Hail % of TIV. Extract the percent or flat amount. Accept formats like "2%", "5% TIV", "$25,000 WH".',
    whereToLook: 'ACORD, proposals, email',
  },
  {
    fieldName: 'floodCoverage',
    businessDescription: 'Indicates whether Flood coverage is included and any associated limit. May be standalone or packaged.',
    extractorLogic: 'Search for Flood, FLD, NFIP, SFHA, Flood Limit, Flood Included, or Flood Excluded. Extract the limit if stated. If only presence is indicated, return "Included" or "Excluded".',
    whereToLook: 'ACORD, quote sheets, proposals',
  },
  {
    fieldName: 'earthquakeCoverage',
    businessDescription: 'Indicates whether Earthquake (EQ) coverage is included and its limit.',
    extractorLogic: 'Search for Earthquake, EQ, Quake, Earthquake Limit, EQ Included, EQ Excluded. Extract numeric limit when provided or return Included/Excluded when binary.',
    whereToLook: 'ACORD, quote sheets, proposals',
  },
  {
    fieldName: 'equipmentBreakdownCoverage',
    businessDescription: 'Specifies whether Equipment Breakdown (EB) coverage is included.',
    extractorLogic: 'Search for EB, Equipment Breakdown, Boiler & Machinery (B&M), Mechanical Breakdown, or "EB Included". Return true if included, false if excluded or declined.',
    whereToLook: 'ACORD, quote sheets, proposals',
  },
  {
    fieldName: 'ordinanceOrLawCoverage',
    businessDescription: 'Indicates whether Ordinance or Law (O&L) coverage is included. Covers demolition and increased cost of construction.',
    extractorLogic: 'Search for Ordinance or Law, O&L, Ordinance, Law Coverage, Demolition Coverage, or ICC (Increased Cost of Construction). Return true/false based on presence.',
    whereToLook: 'ACORD, proposals',
  },
  {
    fieldName: 'terrorismCoverage',
    businessDescription: 'Indicates whether the insured accepted or rejected TRIA terrorism coverage.',
    extractorLogic: 'Search for TRIA, Terrorism, Terrorism Rejection, Terrorism Offer, TRIA Accepted, TRIA Rejected, or "Terrorism: Yes/No". Return true if accepted or included, false if rejected.',
    whereToLook: 'ACORD, TRIA forms, email',
  },
  {
    fieldName: 'blanketCoverageFlag',
    businessDescription: 'Indicates whether property limits apply on a blanket basis across multiple locations or buildings.',
    extractorLogic: 'Search for Blanket, Blanket Limit, Blanket Coverage, Blanket Included, or "Scheduled vs Blanket". Return true if blanket is selected or implied.',
    whereToLook: 'ACORD, proposals, email',
  },
  {
    fieldName: 'blanketDescription',
    businessDescription: 'Describes what is blanket—such as "blanket across all buildings" or "blanket by location".',
    extractorLogic: 'Search for text around Blanket references: Blanket Limit Description, Blanket applies to, Blanket across, All locations, All buildings. Extract the descriptive sentence or phrase that follows.',
    whereToLook: 'ACORD, proposals, email',
  },
  // LOSS HISTORY
  {
    fieldName: 'lossHistoryPeriodYears',
    businessDescription: 'The number of prior years of loss history provided (commonly 3 or 5 years).',
    extractorLogic: 'Search loss runs or email for "3-year loss history", "5 years of losses", "Loss runs for X years", or abbreviations like "3 yr LR". Extract the numeric period.',
    whereToLook: 'Loss runs, email narrative',
  },
  {
    fieldName: 'numberOfClaims',
    businessDescription: 'The total count of claims shown in the provided loss history period.',
    extractorLogic: 'Count lines or entries labeled as claims in loss runs. Search for Claim #, Loss Date, Occurrence, or Loss Entry. Also accept summaries like "Total Claims: X".',
    whereToLook: 'Loss runs',
  },
  {
    fieldName: 'totalIncurredLoss',
    businessDescription: 'The sum of incurred losses, including paid amounts and outstanding reserves.',
    extractorLogic: 'Sum all Incurred values labeled Incurred, Total Incurred, INC, Paid + Reserve, or LOSS INC. Many loss runs show columns such as Paid, Outstanding, and Total Incurred. Use the Total Incurred column if present; otherwise compute Paid + Reserve.',
    whereToLook: 'Loss runs',
  },
  {
    fieldName: 'largestSingleLoss',
    businessDescription: 'The single highest incurred amount from any individual claim.',
    extractorLogic: 'Extract all incurred values from loss runs and return the maximum. Accept values shown under "Largest Loss", "Max Incurred", or simply pick the largest numeric value in the Incurred column.',
    whereToLook: 'Loss runs',
  },
  {
    fieldName: 'anyOpenClaims',
    businessDescription: 'Indicates whether any claims remain open at the time of reporting.',
    extractorLogic: 'Search for claim statuses labeled Open, Closed, Pending, Active, O, C. If any claim status is Open or shows non-zero Outstanding Reserve, return true.',
    whereToLook: 'Loss runs',
  },
  {
    fieldName: 'anyCatLosses',
    businessDescription: 'Whether any claims were categorized as catastrophe (CAT) events.',
    extractorLogic: 'Search for CAT, Catastrophe, Cat Loss, or Cat Code. Some loss runs mark CAT events with "Cat = Yes" or "Peril = Catastrophe". Return true if any such claims appear.',
    whereToLook: 'Loss runs',
  },
  {
    fieldName: 'lossNarrativeSummary',
    businessDescription: 'A text summary describing overall loss performance, themes, or significant events.',
    extractorLogic: 'Extract narrative text from the email body or loss run summary pages containing explanations, commentary, or historic context. Look for sections titled Loss Summary, Narrative, Remarks, Notes, Broker Comments, or Underwriting Notes.',
    whereToLook: 'Loss runs, email narrative',
  },
  // BUILDING FIELDS
  {
    fieldName: 'buildingName',
    businessDescription: 'Optional building label or name used to identify a specific building at a location.',
    extractorLogic: 'Search for building names or labels in SOV columns labeled Building Name, Description, or Building Label. In ACORD forms, check building-level sections for descriptive names. Extract any text that identifies the building beyond just a number.',
    whereToLook: 'SOV, ACORD supplemental',
  },
  {
    fieldName: 'riskAddress',
    businessDescription: 'Full address of the building including street, city, state, and ZIP code.',
    extractorLogic: 'Extract complete addresses from SOV address columns or ACORD building sections. Look for street numbers, street names, city, state abbreviation, and ZIP code. Combine all components into a full address string. If address components are in separate fields, combine them.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'city',
    businessDescription: 'City where the building is located.',
    extractorLogic: 'Extract city name from address fields in SOV or ACORD forms. Look for city names in address lines or dedicated city columns. Return the city name as a string.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'state',
    businessDescription: 'Two-letter state abbreviation where the building is located.',
    extractorLogic: 'Extract state abbreviation (e.g., WA, CA, NY) from address fields. Look for 2-letter state codes in address lines or state columns. Normalize to uppercase 2-letter format.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'zipCode',
    businessDescription: 'ZIP code (5 or 9 digits) for the building address.',
    extractorLogic: 'Extract ZIP codes from address fields. Look for 5-digit or 9-digit ZIP codes (with or without dash). Return as string to preserve leading zeros if present.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'buildingSqFt',
    businessDescription: 'Total building square footage representing the size of the structure.',
    extractorLogic: 'Extract numeric values labeled SqFt, Square Feet, SF, Area, or Building Size. In SOV, look for columns named SqFt, SF, or Square Feet. Remove commas and return as number. Accept formats like "50,000 sq ft" or "50000 SF".',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'numberOfStories',
    businessDescription: 'Number of stories or floors in the building.',
    extractorLogic: 'Search for numeric values labeled Stories, Floors, Levels, or Story Count. Extract the number of stories as an integer. Look for phrases like "2-story", "3 floors", or "Stories: 4".',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'yearBuilt',
    businessDescription: 'Original year the building was constructed.',
    extractorLogic: 'Extract 4-digit year values labeled Year Built, Built, Construction Year, or Yr Built. Look for years typically between 1800 and current year. Return as number.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'yearRenovated',
    businessDescription: 'Year of major renovation or significant update to the building.',
    extractorLogic: 'Search for Year Renovated, Renovated, Last Renovation, or Major Update Year. Extract 4-digit year. Only extract if explicitly labeled as renovation year, not just any update year.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'constructionType',
    businessDescription: 'ISO construction type classification (e.g., Frame, Joisted Masonry, Non-Combustible, Fire Resistive).',
    extractorLogic: 'Extract construction type from SOV columns or ACORD building sections. Look for values like Frame, Joisted Masonry, Non-Combustible, Fire Resistive, Masonry Non-Combustible, or ISO construction codes. May also appear as "Concrete Tilt-Up", "Steel Frame", etc. Return the construction type as stated.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'roofType',
    businessDescription: 'Type of roof material or construction (e.g., Built-up, Single-ply membrane, Metal, Shingle).',
    extractorLogic: 'Search for roof type descriptions labeled Roof Type, Roof Material, or Roof. Look for values like Built-up, Single-ply membrane, TPO, EPDM, Metal, Shingle, Tile, or Flat. Extract the roof type as stated.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'roofYearUpdated',
    businessDescription: 'Year the roof was last updated or replaced.',
    extractorLogic: 'Search for Roof Year, Roof Updated, Roof Replaced, or Last Roof Year. Extract 4-digit year. Only extract if explicitly about roof updates, not general building updates.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'primaryOccupancy',
    businessDescription: 'Main occupancy or use of the building (e.g., Manufacturing, Warehouse, Office, Retail).',
    extractorLogic: 'Extract occupancy descriptions from SOV Occupancy columns or ACORD building sections. Look for values like Manufacturing, Warehouse, Office, Retail, Restaurant, or specific industry types. Return the primary occupancy as stated.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'occupancyPercentage',
    businessDescription: 'Percentage of the building that is occupied (0-100).',
    extractorLogic: 'Extract numeric percentages labeled Occupancy %, % Occupied, or Occupied %. Return as number (0-100). Look for values like "100%", "85% occupied", or "Occupancy: 90".',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'buildingUseHours',
    businessDescription: 'Hours of operation for the building (e.g., "24/7", "8am-5pm", "Monday-Friday 9-5").',
    extractorLogic: 'Search for hours of operation labeled Hours, Operating Hours, Use Hours, or Business Hours. Extract time ranges, days of week, or 24/7 indicators. Return as string preserving the format found.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'sprinklered',
    businessDescription: 'Whether the building has a sprinkler system installed.',
    extractorLogic: 'Search for sprinkler indicators: Sprinklered, Sprinklers, Yes/No indicators, or checkboxes. Look for "100% sprinklered", "Wet pipe sprinklers", or "No sprinklers". Return true if sprinklers are present, false if absent or explicitly stated as none.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'sprinklerType',
    businessDescription: 'Type of sprinkler system (e.g., Wet pipe, Dry pipe, Deluge, Pre-action).',
    extractorLogic: 'Extract sprinkler system type from descriptions. Look for Wet pipe, Dry pipe, Deluge, Pre-action, ESFR (Early Suppression Fast Response), or other system types. Extract the specific type if mentioned.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'sprinklerPercentage',
    businessDescription: 'Percentage of the building covered by sprinklers (0-100).',
    extractorLogic: 'Extract numeric percentages for sprinkler coverage. Look for "100% sprinklered", "% coverage", or "Sprinklered: 95%". Return as number (0-100). If not specified but sprinklers are present, may default to 100%.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'fireAlarmType',
    businessDescription: 'Type of fire alarm system (e.g., Central station, Local, Proprietary, None).',
    extractorLogic: 'Search for fire alarm descriptions labeled Fire Alarm, Alarm Type, or Fire Detection. Look for Central station, Local alarm, Proprietary, Monitored, Unmonitored, or None. Extract the alarm type as stated.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'burglarAlarmType',
    businessDescription: 'Type of burglary or security alarm system.',
    extractorLogic: 'Search for burglar alarm or security system descriptions. Look for Central station, Local, Monitored, Unmonitored, Motion sensors, or security system types. Extract the alarm type if mentioned.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'distanceToHydrantFeet',
    businessDescription: 'Distance from the building to the nearest fire hydrant in feet.',
    extractorLogic: 'Extract numeric values labeled Distance to Hydrant, Hydrant Distance, or Fire Hydrant Distance. Look for values in feet (e.g., "500 ft", "Distance: 250 feet"). Return as number in feet.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'distanceToFireStationMiles',
    businessDescription: 'Distance from the building to the nearest fire station in miles.',
    extractorLogic: 'Extract numeric values labeled Distance to Fire Station, Fire Station Distance, or Station Distance. Look for values in miles (e.g., "2.5 miles", "Distance: 1.2 mi"). Return as number in miles.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'fireProtectionClass',
    businessDescription: 'ISO fire protection class rating (typically 1-10, with 1 being best).',
    extractorLogic: 'Search for ISO Protection Class, Fire Protection Class, or Protection Class. Look for numeric values 1-10, often with decimal (e.g., "Class 3", "Protection Class: 4"). Return the class number.',
    whereToLook: 'SOV, ACORD, email body',
  },
  {
    fieldName: 'neighbouringExposures',
    businessDescription: 'Description of adjacent buildings or exposures that could affect the risk.',
    extractorLogic: 'Extract descriptive text about neighboring buildings, exposures, or adjacent risks. Look for sections labeled Exposures, Neighboring Buildings, Adjacent Properties, or Exposure Description. Extract the narrative description.',
    whereToLook: 'SOV, ACORD, email body',
  },
];

async function updateFieldDefinitions() {
  console.log('Updating field definitions...');

  for (const update of fieldUpdates) {
    try {
      const existing = await prisma.fieldDefinition.findUnique({
        where: { fieldName: update.fieldName },
      });

      if (existing) {
        await prisma.fieldDefinition.update({
          where: { fieldName: update.fieldName },
          data: {
            businessDescription: update.businessDescription,
            extractorLogic: update.extractorLogic,
            whereToLook: update.whereToLook,
          },
        });
        console.log(`✅ Updated ${update.fieldName}`);
      } else {
        // Create the field if it doesn't exist
        await prisma.fieldDefinition.create({
          data: {
            fieldName: update.fieldName,
            category: 'submission',
            fieldType: 'string',
            enteredFieldKey: update.fieldName,
            chatFieldKey: update.fieldName,
            documentFieldKey: update.fieldName,
            businessDescription: update.businessDescription,
            extractorLogic: update.extractorLogic,
            whereToLook: update.whereToLook,
            documentSources: [],
            alternateFieldNames: [],
          },
        });
        console.log(`✅ Created ${update.fieldName}`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${update.fieldName}:`, error);
    }
  }

  console.log('Done!');
}

updateFieldDefinitions()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

