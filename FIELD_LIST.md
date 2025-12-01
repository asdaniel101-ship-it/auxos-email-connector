# Complete Field List by Category

## Total: 64 Fields

---

## 1. SUBMISSION (13 fields)

1. **submissionId** - Internal unique identifier (generated)
2. **carrierName** - Name of insurance carrier
3. **brokerName** - Name of submitting broker/producer
4. **brokerEmail** - Email of submitting broker
5. **brokerPhone** - Phone number of submitting broker
6. **namedInsured** - Legal entity name of insured business
7. **mailingAddress** - Primary mailing address of insured
8. **naicsCode** - Six-digit NAICS industry classification
9. **operationsDescription** - Free-form narrative of business operations
10. **submissionType** - New, renewal, endorsement, etc.
11. **effectiveDate** - Proposed policy start date
12. **expirationDate** - Proposed policy end date
13. **priorCarrier** - Current or expiring carrier name
14. **priorPolicyNumber** - Expiring policy number

---

## 2. LOCATIONS & BUILDINGS (30 fields)

### Location Level (1 field)
15. **locationNumber** - Numeric identifier for each location

### Building Level (29 fields)
16. **buildingNumber** - Numeric identifier for each building
17. **buildingName** - Optional building label/name
18. **riskAddress** - Full address of building (street, city, state, ZIP)
19. **city** - City where building is located
20. **state** - Two-letter state abbreviation
21. **zipCode** - ZIP code (5 or 9 digits)
22. **buildingSqFt** - Total building square footage
23. **numberOfStories** - Number of stories/floors
24. **yearBuilt** - Original construction year
25. **yearRenovated** - Year of major renovation
26. **constructionType** - ISO construction type (Frame, Non-Combustible, etc.)
27. **roofType** - Roof material/type (TPO, Built-up, Metal, etc.)
28. **roofYearUpdated** - Year roof was last updated
29. **primaryOccupancy** - Main occupancy/use (Manufacturing, Office, etc.)
30. **occupancyPercentage** - Percentage of building occupied (0-100)
31. **buildingUseHours** - Hours of operation
32. **sprinklered** - Whether building has sprinklers (boolean)
33. **sprinklerType** - Type of sprinkler system (Wet pipe, Dry pipe, etc.)
34. **sprinklerPercentage** - Percentage of building covered by sprinklers (0-100)
35. **fireAlarmType** - Type of fire alarm system
36. **burglarAlarmType** - Type of burglary/security alarm system
37. **distanceToHydrantFeet** - Distance to nearest fire hydrant (feet)
38. **distanceToFireStationMiles** - Distance to nearest fire station (miles)
39. **fireProtectionClass** - ISO fire protection class rating (1-10)
40. **neighbouringExposures** - Description of adjacent buildings/exposures
41. **buildingLimit** - Insurance limit for building coverage (at building level)

---

## 3. COVERAGE & LIMITS (16 fields)

42. **policyType** - Type of policy (Property, Package, BOP, CPP, etc.)
43. **causeOfLossForm** - Hazard form (Basic, Broad, Special)
44. **coinsurancePercent** - Coinsurance percentage (80%, 90%, 100%)
45. **valuationMethod** - Valuation basis (Replacement Cost, ACV, FRC)
46. **buildingLimit** - Insurance limit for building coverage (at coverage level)
47. **businessPersonalPropertyLimit** - BPP limit
48. **businessIncomeLimit** - Business Income/Extra Expense limit
49. **deductibleAllPeril** - Standard property deductible (flat dollar amount)
50. **windHailDeductible** - Wind/Hail special deductible (flat or percentage)
51. **floodCoverage** - Flood coverage presence and limit
52. **earthquakeCoverage** - Earthquake coverage presence and limit
53. **equipmentBreakdownCoverage** - Equipment Breakdown coverage (boolean)
54. **ordinanceOrLawCoverage** - Ordinance or Law coverage (boolean)
55. **terrorismCoverage** - TRIA terrorism coverage election (boolean)
56. **blanketCoverageFlag** - Whether coverage is blanket (boolean)
57. **blanketDescription** - Description of what is blanket

---

## 4. LOSS HISTORY (7 fields)

58. **lossHistoryPeriodYears** - Number of prior years shown (3 or 5)
59. **numberOfClaims** - Total count of claims in period
60. **totalIncurredLoss** - Sum of paid + outstanding reserves
61. **largestSingleLoss** - Highest incurred amount from single claim
62. **anyOpenClaims** - Whether any claims remain open (boolean)
63. **anyCatLosses** - Whether any catastrophe losses (boolean)
64. **lossNarrativeSummary** - Text summary of loss performance

---

## Field Paths (for reference)

### Submission Fields
- `submission.submissionId`
- `submission.carrierName`
- `submission.brokerName`
- `submission.brokerEmail`
- `submission.brokerPhone`
- `submission.namedInsured`
- `submission.mailingAddress`
- `submission.naicsCode`
- `submission.operationsDescription`
- `submission.submissionType`
- `submission.effectiveDate`
- `submission.expirationDate`
- `submission.priorCarrier`
- `submission.priorPolicyNumber`

### Location & Building Fields
- `locations[0].locationNumber`
- `locations[0].buildings[0].buildingNumber`
- `locations[0].buildings[0].buildingName`
- `locations[0].buildings[0].riskAddress`
- `locations[0].buildings[0].city`
- `locations[0].buildings[0].state`
- `locations[0].buildings[0].zipCode`
- `locations[0].buildings[0].buildingSqFt`
- `locations[0].buildings[0].numberOfStories`
- `locations[0].buildings[0].yearBuilt`
- `locations[0].buildings[0].yearRenovated`
- `locations[0].buildings[0].constructionType`
- `locations[0].buildings[0].roofType`
- `locations[0].buildings[0].roofYearUpdated`
- `locations[0].buildings[0].primaryOccupancy`
- `locations[0].buildings[0].occupancyPercentage`
- `locations[0].buildings[0].buildingUseHours`
- `locations[0].buildings[0].sprinklered`
- `locations[0].buildings[0].sprinklerType`
- `locations[0].buildings[0].sprinklerPercentage`
- `locations[0].buildings[0].fireAlarmType`
- `locations[0].buildings[0].burglarAlarmType`
- `locations[0].buildings[0].distanceToHydrantFeet`
- `locations[0].buildings[0].distanceToFireStationMiles`
- `locations[0].buildings[0].fireProtectionClass`
- `locations[0].buildings[0].neighbouringExposures`
- `locations[0].buildings[0].buildingLimit`

### Coverage Fields
- `coverage.policyType`
- `coverage.causeOfLossForm`
- `coverage.coinsurancePercent`
- `coverage.valuationMethod`
- `coverage.buildingLimit`
- `coverage.businessPersonalPropertyLimit`
- `coverage.businessIncomeLimit`
- `coverage.deductibleAllPeril`
- `coverage.windHailDeductible`
- `coverage.floodCoverage`
- `coverage.earthquakeCoverage`
- `coverage.equipmentBreakdownCoverage`
- `coverage.ordinanceOrLawCoverage`
- `coverage.terrorismCoverage`
- `coverage.blanketCoverageFlag`
- `coverage.blanketDescription`

### Loss History Fields
- `lossHistory.lossHistoryPeriodYears`
- `lossHistory.numberOfClaims`
- `lossHistory.totalIncurredLoss`
- `lossHistory.largestSingleLoss`
- `lossHistory.anyOpenClaims`
- `lossHistory.anyCatLosses`
- `lossHistory.lossNarrativeSummary`

---

## Notes

- **buildingLimit** appears in both `locations[0].buildings[0].buildingLimit` (building-level) and `coverage.buildingLimit` (coverage-level). The building-level one is per-building, while coverage-level is the overall building limit.
- All fields are extracted using per-field LLM calls with field-specific `businessDescription`, `extractorLogic`, and `whereToLook` guidance.
- Fields marked as `boolean` return `true`/`false`.
- Fields marked as `number` return numeric values.
- Fields marked as `string` return text values.
- Fields marked as `date` return date strings.

