# Complete Workers Compensation Field List by Category

## Total: ~70 Fields (30 kept + 40 new)

---

## 1. SUBMISSION & ADMINISTRATIVE (13 fields - KEEP ALL)

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

## 2. LOCATION INFORMATION (6 fields - KEEP)

15. **locationNumber** - Numeric identifier for each location
16. **riskAddress** - Full address of location (street, city, state, ZIP)
17. **city** - City where location is located
18. **state** - Two-letter state abbreviation
19. **zipCode** - ZIP code (5 or 9 digits)
20. **primaryOccupancy** - Main occupancy/use (Manufacturing, Office, etc.) - Useful for understanding work environment

---

## 3. EMPLOYEE & PAYROLL INFORMATION (NEW - Priority 1)

### Per Location/Classification (Array)
21. **classCode** - State-specific WC class code (e.g., "5403", "8810")
22. **classDescription** - Job description for the class code
23. **estimatedAnnualPayroll** - $ amount of payroll for this class/location
24. **numberOfEmployees** - Total employee count for this class
25. **fullTimeEmployees** - Full-time employee count
26. **partTimeEmployees** - Part-time employee count
27. **seasonalEmployees** - Seasonal employee count
28. **employeeType** - Clerical, Outside Sales, etc.

### Overall Payroll
29. **totalEstimatedAnnualPayroll** - Total across all classes/locations
30. **totalEmployeeCount** - Total headcount across all locations
31. **payrollBasis** - Actual, Estimated, or Audited

---

## 4. OWNERS & OFFICERS (NEW - Priority 2)

32. **ownerName** - Name of owner/officer
33. **ownerTitle** - Title (President, VP, etc.)
34. **ownerDuties** - Job duties description
35. **includedExcluded** - Include or exclude from coverage (boolean)
36. **ownershipPercentage** - % ownership stake
37. **estimatedAnnualPayroll** - If included in coverage
38. **classCode** - WC class code if included

---

## 5. EXPERIENCE MODIFICATION & RATING (NEW - Priority 1)

39. **experienceModificationRate** - EMR (e.g., 0.85, 1.20)
40. **emrEffectiveDate** - Date of current EMR
41. **emrState** - State where rated
42. **scheduleRatingCredit** - Schedule credit/debit %
43. **meritRating** - Merit rating if applicable
44. **retrospectiveRating** - Yes/No (boolean)

---

## 6. COVERAGE DETAILS (NEW - Priority 1)

### Employers Liability Limits
45. **eachAccidentLimit** - Coverage A (typically $100,000+)
46. **diseasePolicyLimit** - Coverage B (typically $500,000+)
47. **diseaseEachEmployeeLimit** - Coverage C (typically $100,000+)

### State Coverage
48. **statesOfOperation** - Array of all states where employees work
49. **monopolisticStates** - OH, ND, WA, WY if applicable (array)

### Additional Coverages
50. **waiverOfSubrogation** - Yes/No (boolean)
51. **waiverOfSubrogationFor** - Specific entities (array)
52. **additionalInsured** - List of additional insureds (array)
53. **alternateEmployer** - Yes/No (boolean)
54. **voluntaryCompensation** - Yes/No (boolean)
55. **foreignVoluntaryWorkers** - Yes/No (boolean)
56. **uslhEndorsement** - USL&H coverage (boolean)
57. **maritimeEndorsement** - Maritime coverage (boolean)

---

## 7. LOSS HISTORY (7 fields - KEEP ALL)

58. **lossHistoryPeriodYears** - Number of prior years shown (3 or 5)
59. **numberOfClaims** - Total count of claims in period
60. **totalIncurredLoss** - Sum of paid + outstanding reserves
61. **largestSingleLoss** - Highest incurred amount from single claim
62. **anyOpenClaims** - Whether any claims remain open (boolean)
63. **anyCatLosses** - Whether any catastrophe losses (boolean) - Less relevant for WC but keep
64. **lossNarrativeSummary** - Text summary of loss performance

**Note:** Individual claim fields (claimNumber, dateOfLoss, injuryType, etc.) already exist in the system - see existing claims array structure.

---

## 8. SAFETY & RISK MANAGEMENT (NEW - Priority 3)

65. **writtenSafetyProgram** - Yes/No (boolean)
66. **safetyCommittee** - Yes/No (boolean)
67. **safetyMeetingFrequency** - Weekly, Monthly, etc.
68. **drugTestingProgram** - Yes/No (boolean)
69. **drugTestingType** - Pre-employment, Random, Post-accident
70. **returnToWorkProgram** - Yes/No (boolean)
71. **modifiedDutyAvailable** - Yes/No (boolean)
72. **safetyTrainingProvided** - Yes/No (boolean)
73. **safetyTrainingTopics** - List of topics (array)
74. **oshaRecordable** - Number of OSHA recordables
75. **oshaLostTimeCases** - Number of lost time cases
76. **oshaDartRate** - DART rate if available

---

## 9. SUBCONTRACTORS (NEW - Priority 3)

77. **useSubcontractors** - Yes/No (boolean)
78. **estimatedAnnualCost** - $ paid to subs
79. **certificatesRequired** - Yes/No (boolean)
80. **certificatesOnFile** - Yes/No (boolean)
81. **subcontractorTypes** - Types of work subcontracted (array)

---

## 10. VEHICLE INFORMATION (NEW - Priority 3)

82. **numberOfVehicles** - Count
83. **employeesOperatingVehicles** - Count
84. **vehicleTypes** - Types (Truck, Van, etc.) (array)
85. **mileageRadius** - Local, Intermediate, Long Distance
86. **commercialAutoPolicy** - Yes/No (boolean)
87. **hiredNonOwnedCoverage** - Yes/No (boolean)

---

## 11. ADDITIONAL BUSINESS INFORMATION (NEW - Priority 2)

88. **yearBusinessEstablished** - Year started
89. **legalEntity** - Corporation, LLC, Sole Proprietor, Partnership
90. **fein** - Federal Employer ID Number
91. **websiteUrl** - Company website
92. **parentCompany** - If applicable
93. **affiliatedCompanies** - Related entities (array)
94. **seasonalOperations** - Yes/No (boolean)
95. **peakSeasons** - Months of peak activity (array)
96. **annualRevenue** - Gross revenue
97. **yearsWithCurrentManagement** - Years

---

## 12. CONTACT INFORMATION (NEW)

98. **primaryContactName** - Primary contact name
99. **primaryContactTitle** - Primary contact title
100. **primaryContactPhone** - Primary contact phone
101. **primaryContactEmail** - Primary contact email
101. **hrContactName** - HR contact name
102. **hrContactEmail** - HR contact email
103. **safetyContactName** - Safety contact name
104. **safetyContactEmail** - Safety contact email

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

### Location Fields
- `locations[0].locationNumber`
- `locations[0].riskAddress`
- `locations[0].city`
- `locations[0].state`
- `locations[0].zipCode`
- `locations[0].primaryOccupancy`

### Classification & Payroll Fields
- `locations[0].classifications[0].classCode`
- `locations[0].classifications[0].classDescription`
- `locations[0].classifications[0].estimatedAnnualPayroll`
- `locations[0].classifications[0].numberOfEmployees`
- `locations[0].classifications[0].fullTimeEmployees`
- `locations[0].classifications[0].partTimeEmployees`
- `locations[0].classifications[0].seasonalEmployees`
- `locations[0].classifications[0].employeeType`
- `payroll.totalEstimatedAnnualPayroll`
- `payroll.totalEmployeeCount`
- `payroll.payrollBasis`

### Owners & Officers Fields
- `owners[0].ownerName`
- `owners[0].ownerTitle`
- `owners[0].ownerDuties`
- `owners[0].includedExcluded`
- `owners[0].ownershipPercentage`
- `owners[0].estimatedAnnualPayroll`
- `owners[0].classCode`

### Rating Fields
- `rating.experienceModificationRate`
- `rating.emrEffectiveDate`
- `rating.emrState`
- `rating.scheduleRatingCredit`
- `rating.meritRating`
- `rating.retrospectiveRating`

### Coverage Fields
- `coverage.eachAccidentLimit`
- `coverage.diseasePolicyLimit`
- `coverage.diseaseEachEmployeeLimit`
- `coverage.statesOfOperation`
- `coverage.monopolisticStates`
- `coverage.waiverOfSubrogation`
- `coverage.waiverOfSubrogationFor`
- `coverage.additionalInsured`
- `coverage.alternateEmployer`
- `coverage.voluntaryCompensation`
- `coverage.foreignVoluntaryWorkers`
- `coverage.uslhEndorsement`
- `coverage.maritimeEndorsement`

### Loss History Fields
- `lossHistory.lossHistoryPeriodYears`
- `lossHistory.numberOfClaims`
- `lossHistory.totalIncurredLoss`
- `lossHistory.largestSingleLoss`
- `lossHistory.anyOpenClaims`
- `lossHistory.anyCatLosses`
- `lossHistory.lossNarrativeSummary`

### Safety Fields
- `safety.writtenSafetyProgram`
- `safety.safetyCommittee`
- `safety.safetyMeetingFrequency`
- `safety.drugTestingProgram`
- `safety.drugTestingType`
- `safety.returnToWorkProgram`
- `safety.modifiedDutyAvailable`
- `safety.safetyTrainingProvided`
- `safety.safetyTrainingTopics`
- `safety.oshaRecordable`
- `safety.oshaLostTimeCases`
- `safety.oshaDartRate`

### Subcontractor Fields
- `subcontractors.useSubcontractors`
- `subcontractors.estimatedAnnualCost`
- `subcontractors.certificatesRequired`
- `subcontractors.certificatesOnFile`
- `subcontractors.subcontractorTypes`

### Vehicle Fields
- `vehicles.numberOfVehicles`
- `vehicles.employeesOperatingVehicles`
- `vehicles.vehicleTypes`
- `vehicles.mileageRadius`
- `vehicles.commercialAutoPolicy`
- `vehicles.hiredNonOwnedCoverage`

### Business Information Fields
- `business.yearBusinessEstablished`
- `business.legalEntity`
- `business.fein`
- `business.websiteUrl`
- `business.parentCompany`
- `business.affiliatedCompanies`
- `business.seasonalOperations`
- `business.peakSeasons`
- `business.annualRevenue`
- `business.yearsWithCurrentManagement`

### Contact Fields
- `contacts.primaryContactName`
- `contacts.primaryContactTitle`
- `contacts.primaryContactPhone`
- `contacts.primaryContactEmail`
- `contacts.hrContactName`
- `contacts.hrContactEmail`
- `contacts.safetyContactName`
- `contacts.safetyContactEmail`

---

## Notes

- **Removed Property-Specific Fields:** All building construction, fire protection, property coverage, and property limits fields have been removed (34 fields total).
- **Claims Fields:** Individual claim fields (claimNumber, dateOfLoss, injuryType, bodyPartAffected, etc.) already exist in the system as part of the claims array structure - no need to re-add.
- All fields are extracted using per-field LLM calls with field-specific `businessDescription`, `extractorLogic`, and `whereToLook` guidance.
- Fields marked as `boolean` return `true`/`false`.
- Fields marked as `number` return numeric values.
- Fields marked as `string` return text values.
- Fields marked as `date` return date strings.
- Array fields (e.g., `locations[0]`, `classifications[0]`, `owners[0]`) support multiple entries.

---

## Priority Order for Implementation

**Priority 1 - CANNOT QUOTE WITHOUT:**
- Payroll by classification (class code + estimated annual payroll)
- Employee counts (by classification)
- States of operation
- Employers Liability limits
- Experience Mod (EMR)

**Priority 2 - REQUIRED FOR ACCURATE RATING:**
- Owner/officer information (include/exclude)
- Detailed loss history (individual claims - already exists)
- FEIN
- Legal entity type

**Priority 3 - UNDERWRITING CONSIDERATIONS:**
- Safety programs
- Subcontractor information
- Drug testing
- Return to work program
