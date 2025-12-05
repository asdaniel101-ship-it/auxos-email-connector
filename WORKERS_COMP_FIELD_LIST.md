# Complete Workers Compensation Field List

## Total Fields: ~100+ (across all sections)

---

## A. SUBMISSION & ADMINISTRATIVE (22 fields)

1. **applicantName** (string) - Legal name of the business entity seeking workers comp coverage
2. **mailingAddress** (string) - Primary mailing address for the insured; official correspondence address
3. **officePhone** (string) - Main business phone number of the insured
4. **mobilePhone** (string) - Mobile phone of the primary insured contact
5. **website** (string) - Official website of the insured business
6. **yearsInBusiness** (number) - Number of years the business has operated (under current or predecessor ownership)
7. **fein** (string) - Federal Employer Identification Number (9-digit tax ID) for the insured
8. **ncciRiskId** (string) - NCCI-assigned Risk ID used for experience rating and WC data
9. **otherEmployerRegistrationNumber** (string) - Any state or other rating bureau employer registration number
10. **submissionType** (string) - Type of transaction requested: quote only, bind/issue, or assigned risk/other special handling
11. **agencyName** (string) - Name of the broker/agency submitting the risk
12. **agencyAddress** (string) - Mailing address of the submitting agency
13. **producerName** (string) - Primary producer/agent managing the account at the agency
14. **csrName** (string) - Account manager/CSR supporting the producer
15. **producerEmail** (string) - Email address of the main producer contact
16. **producerPhone** (string) - Direct phone number for producer
17. **underwriterName** (string) - Carrier underwriter the submission is being addressed to (if specified)
18. **agencyCustomerId** (string) - Internal account identifier used in the agency's system
19. **billingPlan** (string) - Whether the account will be agency-billed or direct-billed and any special billing instructions
20. **paymentPlan** (string) - Requested installment schedule (annual, quarterly, monthly reporting, etc.)
21. **auditType** (string) - How and when payroll audit is performed (at expiration vs. periodic self-reporting)

---

## B. BUSINESS ENTITY & OPERATIONS / GENERAL INFO (25 fields)

22. **entityType** (string) - Legal structure of the insured entity (e.g., individual, partnership, corporation, LLC, etc.)
23. **operationsDescription** (text) - Narrative description of what the business does: services performed, products, customers, and work environment
24. **hazardousMaterialsExposure** (boolean) - Whether the insured's operations involve storing, treating, discharging, applying, disposing, or transporting hazardous materials
25. **aircraftOrWatercraftOwned** (boolean) - Whether the insured owns, operates, or leases aircraft or watercraft as part of its operations
26. **workUndergroundOrAbove15Feet** (boolean) - Indicates whether employees perform work underground or above 15 feet
27. **workOverWater** (boolean) - Whether any work is performed on barges, vessels, docks, piers, or bridges over water
28. **subcontractorUsage** (boolean) - Indicates whether the insured uses subcontractors to perform part of the work
29. **subcontractorPercentageSubcontracted** (number) - Approximate percentage of total work or revenue subcontracted to others
30. **workSubletWithoutCOI** (boolean) - Whether any work is sublet to subcontractors who do not provide certificates of insurance (COIs) for WC and GL
31. **otherBusinessOperations** (text) - Other types of business activities conducted by the insured beyond the main operations
32. **safetyProgramInOperation** (boolean) - Whether there is a formal written safety program in place (policies, training, documented procedures)
33. **groupTransportationProvided** (boolean) - Whether the employer provides transportation for groups of employees (e.g., vans, buses, crew trucks) to job sites
34. **employeesUnder16OrOver60** (boolean) - Whether any employees are younger than 16 or older than 60
35. **seasonalEmployees** (boolean) - Whether the insured uses seasonal workers (e.g., during summer, harvest, holiday season)
36. **volunteerOrDonatedLabor** (boolean) - Use of workers who are not paid employees but volunteer or provide donated labor
37. **employeesWithPhysicalHandicaps** (boolean) - Whether any employees with physical handicaps are employed
38. **employeesTravelOutOfState** (boolean) - Whether employees travel outside the main state of operation, including which states and how often
39. **athleticTeamsSponsored** (boolean) - Whether the employer sponsors athletic teams (e.g., company softball or soccer teams)
40. **preEmploymentPhysicalsRequired** (boolean) - Whether physical exams are required after offers of employment are made
41. **otherInsuranceWithThisInsurer** (boolean) - Whether the insured has other policies (e.g., GL, auto, property) with the same carrier
42. **priorCoverageDeclinedOrCancelled** (boolean) - Whether prior workers comp coverage has been declined, cancelled, or non-renewed within the recent past (usually 3 years)
43. **employeeHealthPlansProvided** (boolean) - Whether the employer provides health insurance plans to employees (group medical)
44. **leasedEmployees** (boolean) - Whether the insured leases employees to or from another entity (PEO or staff leasing arrangement)
45. **employeesWorkingAtHome** (boolean) - Whether employees predominantly work from home and how many
46. **taxLiensOrBankruptcyLast5Years** (boolean) - Whether the insured has had any tax liens or bankruptcy within the last five years
47. **unpaidWCPremiumLast5Years** (boolean) - Whether there is any undisputed, unpaid workers comp premium due from the insured or commonly managed/owned enterprises

---

## C. LOCATIONS (7 fields per location - array)

48. **locationNumber** (number) - Numeric identifier used to distinguish each physical location
49. **locationStreetAddress** (string) - Street address of the location
50. **locationCity** (string) - City of the location
51. **locationCounty** (string) - County of the location
52. **locationState** (string) - State of the location (2-letter abbreviation)
53. **locationZip** (string) - ZIP code of the location
54. **locationFloor** (string) - Floor or suite number if applicable

---

## D. CLASSIFICATION / PAYROLL / RATING (10 fields per classification - array)

55. **wcState** (string) - State for which this classification applies
56. **ratingLocationNumber** (number) - Location number for rating purposes
57. **classCode** (string) - NCCI class code for this classification
58. **classCodeDescription** (string) - Description of the class code
59. **dutiesDescription** (text) - Description of duties performed under this classification
60. **numEmployeesFullTime** (number) - Number of full-time employees
61. **numEmployeesPartTime** (number) - Number of part-time employees
62. **estimatedAnnualPayroll** (number) - Estimated annual payroll for this classification
63. **rate** (decimal) - Rate per $100 of payroll for this classification
64. **estimatedAnnualManualPremium** (number) - Estimated annual manual premium for this classification

---

## E. COVERAGES & LIMITS (11 fields)

65. **coveredStatesPart1** (string) - States covered under Part 1 (Workers Compensation)
66. **otherStatesInsuranceStatesPart3** (string) - States covered under Part 3 (Other States Insurance)
67. **excludedStatesPart1** (string) - States excluded from Part 1 coverage
68. **employersLiabilityEachAccident** (number) - Employers Liability limit - Each Accident
69. **employersLiabilityDiseasePolicyLimit** (number) - Employers Liability limit - Disease Policy Limit
70. **employersLiabilityDiseaseEachEmployee** (number) - Employers Liability limit - Disease Each Employee
71. **medicalDeductible** (number) - Medical deductible amount
72. **indemnityDeductible** (number) - Indemnity deductible amount
73. **uslhCoverage** (boolean) - Whether USLH (US Longshore and Harbor Workers) coverage is included
74. **volunteerCompCoverage** (boolean) - Whether Volunteer Compensation coverage is included
75. **foreignCoverage** (boolean) - Whether Foreign coverage is included
76. **managedCareOption** (string) - Managed care option selected (if any)

---

## F. PAYROLL & EXPOSURE ATTACHMENTS (6 fields)

77. **payrollScheduleAttached** (boolean) - Whether payroll schedule is attached
78. **payrollByClassAndState** (text) - Payroll breakdown by class code and state
79. **overtimePayroll** (number) - Overtime payroll amount
80. **clericalPayroll** (number) - Clerical payroll amount
81. **outsideSalesPayroll** (number) - Outside sales payroll amount
82. **subcontractorPayroll** (number) - Subcontractor payroll amount
83. **uninsuredSubcontractorPayroll** (number) - Uninsured subcontractor payroll amount

---

## G. PRIOR CARRIER & LOSS HISTORY (9 fields)

84. **priorCarrierYear** (number) - Year of prior carrier policy
85. **priorCarrierName** (string) - Name of prior carrier
86. **priorPolicyNumber** (string) - Prior policy number
87. **priorAnnualPremium** (number) - Prior annual premium amount
88. **priorExperienceMod** (decimal) - Prior experience modification factor
89. **priorNumberOfClaims** (number) - Number of claims under prior carrier
90. **priorAmountPaid** (number) - Total amount paid on prior claims
91. **priorReserve** (number) - Total reserves on prior claims
92. **lossRunsAttached** (boolean) - Whether loss runs are attached

---

## H. LOSS HISTORY / CLAIMS (12 fields per claim - array)

93. **claimNumber** (string) - Claim number
94. **claimStatus** (string) - Status of the claim (Open, Closed, etc.)
95. **claimType** (string) - Type of claim
96. **claimDateOfLoss** (date) - Date of loss
97. **claimDescription** (text) - Description of the claim
98. **claimCauseOfInjury** (string) - Cause of injury
99. **claimBodyPart** (string) - Body part injured
100. **claimPaidIndemnity** (number) - Indemnity amount paid
101. **claimPaidMedical** (number) - Medical amount paid
102. **claimReserve** (number) - Current reserve amount
103. **claimTotalIncurred** (number) - Total incurred (paid + reserve)
104. **claimLitigationFlag** (boolean) - Whether claim is in litigation

---

## I. INDIVIDUALS INCLUDED / EXCLUDED (10 fields per individual - array)

105. **individualState** (string) - State for this individual
106. **individualLocationNumber** (number) - Location number for this individual
107. **individualName** (string) - Name of the individual
108. **individualTitle** (string) - Title/position of the individual
109. **individualOwnershipPercent** (number) - Ownership percentage
110. **individualRelationship** (string) - Relationship to the business
111. **individualDuties** (text) - Duties performed by the individual
112. **individualIncludeOrExcludeWC** (string) - Whether individual is included or excluded from WC coverage
113. **individualClassCode** (string) - Class code for this individual
114. **individualRemunerationPayroll** (number) - Remuneration/payroll for this individual

---

## J. PREMIUM SUMMARY (3 fields)

115. **totalEstimatedAnnualPremiumAllStates** (number) - The sum of estimated annual manual premiums across all states and class codes before adjustments (mods, schedule credits, taxes)
116. **totalMinimumPremiumAllStates** (number) - Some carriers apply a minimum premium per state or per policy. This is the sum of all minimum premiums required across all states
117. **totalDepositPremiumAllStates** (number) - The deposit premium the insured must pay at policy inception — usually the estimated annual premium times a deposit percentage or the full annual premium if pay-in-full

---

## Field Paths (for reference)

### Submission Fields
- `submission.applicantName`
- `submission.mailingAddress`
- `submission.officePhone`
- `submission.mobilePhone`
- `submission.website`
- `submission.yearsInBusiness`
- `submission.fein`
- `submission.ncciRiskId`
- `submission.otherEmployerRegistrationNumber`
- `submission.submissionType`
- `submission.agencyName`
- `submission.agencyAddress`
- `submission.producerName`
- `submission.csrName`
- `submission.producerEmail`
- `submission.producerPhone`
- `submission.underwriterName`
- `submission.agencyCustomerId`
- `submission.billingPlan`
- `submission.paymentPlan`
- `submission.auditType`

### Business Entity Fields
- `businessEntity.entityType`
- `businessEntity.operationsDescription`
- `businessEntity.hazardousMaterialsExposure`
- `businessEntity.aircraftOrWatercraftOwned`
- `businessEntity.workUndergroundOrAbove15Feet`
- `businessEntity.workOverWater`
- `businessEntity.subcontractorUsage`
- `businessEntity.subcontractorPercentageSubcontracted`
- `businessEntity.workSubletWithoutCOI`
- `businessEntity.otherBusinessOperations`
- `businessEntity.safetyProgramInOperation`
- `businessEntity.groupTransportationProvided`
- `businessEntity.employeesUnder16OrOver60`
- `businessEntity.seasonalEmployees`
- `businessEntity.volunteerOrDonatedLabor`
- `businessEntity.employeesWithPhysicalHandicaps`
- `businessEntity.employeesTravelOutOfState`
- `businessEntity.athleticTeamsSponsored`
- `businessEntity.preEmploymentPhysicalsRequired`
- `businessEntity.otherInsuranceWithThisInsurer`
- `businessEntity.priorCoverageDeclinedOrCancelled`
- `businessEntity.employeeHealthPlansProvided`
- `businessEntity.leasedEmployees`
- `businessEntity.employeesWorkingAtHome`
- `businessEntity.taxLiensOrBankruptcyLast5Years`
- `businessEntity.unpaidWCPremiumLast5Years`

### Location Fields (array)
- `locations[0].locationNumber`
- `locations[0].locationStreetAddress`
- `locations[0].locationCity`
- `locations[0].locationCounty`
- `locations[0].locationState`
- `locations[0].locationZip`
- `locations[0].locationFloor`

### Classification Fields (array)
- `classification[0].wcState`
- `classification[0].ratingLocationNumber`
- `classification[0].classCode`
- `classification[0].classCodeDescription`
- `classification[0].dutiesDescription`
- `classification[0].numEmployeesFullTime`
- `classification[0].numEmployeesPartTime`
- `classification[0].estimatedAnnualPayroll`
- `classification[0].rate`
- `classification[0].estimatedAnnualManualPremium`

### Coverage Fields
- `coverage.coveredStatesPart1`
- `coverage.otherStatesInsuranceStatesPart3`
- `coverage.excludedStatesPart1`
- `coverage.employersLiabilityEachAccident`
- `coverage.employersLiabilityDiseasePolicyLimit`
- `coverage.employersLiabilityDiseaseEachEmployee`
- `coverage.medicalDeductible`
- `coverage.indemnityDeductible`
- `coverage.uslhCoverage`
- `coverage.volunteerCompCoverage`
- `coverage.foreignCoverage`
- `coverage.managedCareOption`

### Payroll Fields
- `payroll.payrollScheduleAttached`
- `payroll.payrollByClassAndState`
- `payroll.overtimePayroll`
- `payroll.clericalPayroll`
- `payroll.outsideSalesPayroll`
- `payroll.subcontractorPayroll`
- `payroll.uninsuredSubcontractorPayroll`

### Prior Carrier Fields
- `priorCarrier.priorCarrierYear`
- `priorCarrier.priorCarrierName`
- `priorCarrier.priorPolicyNumber`
- `priorCarrier.priorAnnualPremium`
- `priorCarrier.priorExperienceMod`
- `priorCarrier.priorNumberOfClaims`
- `priorCarrier.priorAmountPaid`
- `priorCarrier.priorReserve`
- `priorCarrier.lossRunsAttached`

### Loss History Fields (array)
- `lossHistory[0].claimNumber`
- `lossHistory[0].claimStatus`
- `lossHistory[0].claimType`
- `lossHistory[0].claimDateOfLoss`
- `lossHistory[0].claimDescription`
- `lossHistory[0].claimCauseOfInjury`
- `lossHistory[0].claimBodyPart`
- `lossHistory[0].claimPaidIndemnity`
- `lossHistory[0].claimPaidMedical`
- `lossHistory[0].claimReserve`
- `lossHistory[0].claimTotalIncurred`
- `lossHistory[0].claimLitigationFlag`

### Individuals Fields (array)
- `individuals[0].individualState`
- `individuals[0].individualLocationNumber`
- `individuals[0].individualName`
- `individuals[0].individualTitle`
- `individuals[0].individualOwnershipPercent`
- `individuals[0].individualRelationship`
- `individuals[0].individualDuties`
- `individuals[0].individualIncludeOrExcludeWC`
- `individuals[0].individualClassCode`
- `individuals[0].individualRemunerationPayroll`

### Premium Summary Fields
- `premiumSummary.totalEstimatedAnnualPremiumAllStates`
- `premiumSummary.totalMinimumPremiumAllStates`
- `premiumSummary.totalDepositPremiumAllStates`

---

## Notes

- All fields are extracted using per-field LLM calls with field-specific `businessDescription`, `extractorLogic`, and `whereToLook` guidance.
- Fields marked as `boolean` return `true`/`false`.
- Fields marked as `number` return numeric values.
- Fields marked as `string` return text values.
- Fields marked as `text` return longer text values.
- Fields marked as `date` return date strings.
- Fields marked as `decimal` return decimal/float values.
- Array fields (locations, classification, lossHistory, individuals) can have multiple items.
- Each field also has `inAcord130` (Yes/No/Sometimes) and `whereInAcord130` (description) attributes for ACORD 130 form pre-filling.

