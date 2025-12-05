# Expected Document Attachments for Workers Compensation Submissions

## Document Types Recognized by the System

The system automatically classifies attachments into the following document types:

---

## 1. PAYROLL (`payroll`)

**Description:** Payroll reports, schedules, or breakdowns showing employee payroll by class code and/or state.

**Detection Keywords:**
- `payroll`
- `payroll schedule`
- `payroll_by_class`
- `payroll_report`

**Common File Names:**
- `PayrollByClassState.xlsx`
- `Payroll_Schedule.xlsx`
- `Payroll_Report_2024.xlsx`
- `Payroll_by_Class_and_State.xlsx`
- `PayrollByClassState.csv`

**File Formats:**
- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)
- PDF (`.pdf`)

**What Information is Extracted:**
- Payroll by class code and state
- Employee counts (full-time, part-time)
- Estimated annual payroll
- Rates per $100 of payroll
- Estimated annual manual premium

**Used For Fields:**
- `classification[*].estimatedAnnualPayroll`
- `classification[*].rate`
- `classification[*].estimatedAnnualManualPremium`
- `classification[*].numEmployeesFullTime`
- `classification[*].numEmployeesPartTime`
- `payroll.payrollByClassAndState`
- `payroll.overtimePayroll`
- `payroll.clericalPayroll`
- `payroll.outsideSalesPayroll`
- `payroll.subcontractorPayroll`

---

## 2. QUESTIONNAIRE (`questionnaire`)

**Description:** Workers Compensation questionnaire forms filled out by the insured.

**Detection Keywords:**
- `questionnaire`
- `wc questionnaire`

**Common File Names:**
- `WC_Questionnaire.pdf`
- `Workers_Comp_Questionnaire.docx`
- `WC_Supplemental_Questionnaire.pdf`
- `Questionnaire_2024.pdf`

**File Formats:**
- PDF (`.pdf`)
- Word (`.docx`, `.doc`)

**What Information is Extracted:**
- Business operations description
- Entity type
- Safety program information
- Subcontractor usage
- Employee demographics
- Hazardous materials exposure
- Work environment details

**Used For Fields:**
- `businessEntity.operationsDescription`
- `businessEntity.entityType`
- `businessEntity.safetyProgramInOperation`
- `businessEntity.subcontractorUsage`
- `businessEntity.hazardousMaterialsExposure`
- `businessEntity.workUndergroundOrAbove15Feet`
- `businessEntity.workOverWater`
- And many other business entity fields

---

## 3. APPLICATION (`application`)

**Description:** Workers Compensation application forms (similar to questionnaire but more formal).

**Detection Keywords:**
- `application`
- `wc application`
- `workers comp application`

**Common File Names:**
- `WC_Application.pdf`
- `Workers_Compensation_Application.docx`
- `Application_Form_2024.pdf`
- `WC_App.pdf`

**File Formats:**
- PDF (`.pdf`)
- Word (`.docx`, `.doc`)

**What Information is Extracted:**
- Similar to questionnaire - business information, operations, exposures
- May include more formal/structured data

**Used For Fields:**
- Same as questionnaire (business entity fields)
- Submission administrative fields

---

## 4. SUPPLEMENTAL (`supplemental`)

**Description:** Additional supporting documents, supplemental forms, or miscellaneous information.

**Detection Keywords:**
- `supplemental`
- `additional`
- `misc`

**Common File Names:**
- `WC_Supplemental.docx`
- `Supplemental_Information.pdf`
- `Additional_Documents.pdf`
- `Misc_Info.pdf`
- `WC_Supplemental_Form.docx`

**File Formats:**
- PDF (`.pdf`)
- Word (`.docx`, `.doc`)
- Excel (`.xlsx`, `.xls`)
- Text (`.txt`)

**What Information is Extracted:**
- Additional business operations details
- Special exposures or circumstances
- Clarifications or additional context
- Any other relevant information not captured in main documents

**Used For Fields:**
- `businessEntity.otherBusinessOperations`
- `businessEntity.*` (various fields)
- Additional context for other fields

---

## 5. LOSS RUN (`loss_run`)

**Description:** Loss history reports showing prior claims, losses, and experience.

**Detection Keywords:**
- `loss run`
- `loss_run`
- `loss history`
- `loss_history`
- `claims experience`
- `claims_experience`

**Common File Names:**
- `WC_LossRuns.pdf`
- `Loss_Run_2024.pdf`
- `Loss_History_3_Years.pdf`
- `Claims_Experience.pdf`
- `Loss_Runs_2021-2024.pdf`

**File Formats:**
- PDF (`.pdf`)
- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)

**What Information is Extracted:**
- Individual claim details (claim number, date of loss, description, amounts)
- Claim status (open, closed)
- Paid amounts (indemnity, medical)
- Reserve amounts
- Total incurred
- Litigation flags
- Aggregate loss statistics

**Used For Fields:**
- `lossHistory[*].claimNumber`
- `lossHistory[*].claimStatus`
- `lossHistory[*].claimType`
- `lossHistory[*].claimDateOfLoss`
- `lossHistory[*].claimDescription`
- `lossHistory[*].claimCauseOfInjury`
- `lossHistory[*].claimBodyPart`
- `lossHistory[*].claimPaidIndemnity`
- `lossHistory[*].claimPaidMedical`
- `lossHistory[*].claimReserve`
- `lossHistory[*].claimTotalIncurred`
- `lossHistory[*].claimLitigationFlag`
- `priorCarrier.priorNumberOfClaims`
- `priorCarrier.priorAmountPaid`
- `priorCarrier.priorReserve`

---

## 6. SCHEDULE (`schedule`)

**Description:** Excel spreadsheets containing property, location, or other scheduled information.

**Detection Keywords:**
- Excel/Spreadsheet files (`.xlsx`, `.xls`) that don't match other categories

**Common File Names:**
- `Officers_Schedule.xlsx`
- `Employee_Roster.xlsx`
- `Location_Schedule.xlsx`
- `Class_Code_Schedule.xlsx`
- `Schedule_of_Values.xlsx`

**File Formats:**
- Excel (`.xlsx`, `.xls`)

**What Information is Extracted:**
- Officer/executive information
- Employee rosters
- Location details
- Class code schedules
- Other tabular data

**Used For Fields:**
- `individuals[*].individualName`
- `individuals[*].individualTitle`
- `individuals[*].individualOwnershipPercent`
- `individuals[*].individualRemunerationPayroll`
- `locations[*].locationNumber`
- `locations[*].locationStreetAddress`
- `locations[*].locationCity`
- `locations[*].locationState`
- `locations[*].locationZip`

---

## 7. SOV (`sov`)

**Description:** Statement of Values - property valuation schedules (legacy from BOP, may still appear).

**Detection Keywords:**
- `sov`
- `statement of values`
- `statement_of_values`

**Common File Names:**
- `SOV_2024.xlsx`
- `Statement_of_Values.pdf`
- `SOV_Schedule.xlsx`

**File Formats:**
- Excel (`.xlsx`, `.xls`)
- PDF (`.pdf`)

**What Information is Extracted:**
- Property values
- Building schedules
- Location information

**Note:** This is a legacy document type from BOP insurance. For Workers Comp, it may contain location or property information that's relevant.

---

## 8. OTHER (`other`)

**Description:** Any document that doesn't match the above categories.

**Common File Names:**
- `Experience_Mod.pdf`
- `Certificate_of_Insurance.pdf`
- `Safety_Manual.pdf`
- `Org_Chart.pdf`
- Any other document

**File Formats:**
- Any format (PDF, Word, Excel, CSV, Text, Images, etc.)

**What Information is Extracted:**
- System attempts to extract any relevant information
- May contain context for other fields
- Experience mod information
- Safety program details
- Organizational information

**Used For Fields:**
- `priorCarrier.priorExperienceMod`
- `businessEntity.safetyProgramInOperation`
- Additional context for various fields

---

## 9. EMAIL BODY (`email_body`)

**Description:** The email body text itself (not an attachment, but treated as a document source).

**Source:** The submission email body text

**What Information is Extracted:**
- Submission narrative
- Broker notes and comments
- Business description
- Key highlights
- Contact information
- Submission type and dates

**Used For Fields:**
- `submission.applicantName`
- `submission.submissionType`
- `submission.agencyName`
- `submission.producerName`
- `submission.producerEmail`
- `submission.producerPhone`
- `businessEntity.operationsDescription`
- `priorCarrier.priorCarrierName`
- Various other fields that may be mentioned in the email

---

## Document Classification Priority

The system classifies documents in this order (first match wins):

1. **Payroll** - If filename contains payroll keywords
2. **Questionnaire/Application** - If filename contains questionnaire/application keywords
3. **SOV** - If filename contains SOV keywords
4. **Loss Run** - If filename contains loss run keywords
5. **Schedule** - If file is Excel/spreadsheet (and doesn't match above)
6. **Supplemental** - If filename contains supplemental/additional/misc keywords
7. **Other** - Default for everything else

---

## File Format Support

The system can parse the following file formats:

### Supported Formats:
- **PDF** (`.pdf`) - Text extraction with enhanced formatting
- **Excel** (`.xlsx`, `.xls`) - Full spreadsheet parsing with table detection
- **Word** (`.docx`, `.doc`) - Text and table extraction
- **CSV** (`.csv`) - Tabular data parsing
- **Text** (`.txt`) - Plain text extraction
- **Email** (`.eml`) - Email parsing and attachment extraction

### Format-Specific Features:
- **PDF**: Enhanced text extraction with key-value pair detection, section headers
- **Excel**: Multi-sheet support, header detection, row-by-row parsing
- **Word**: Table structure preservation, HTML conversion for better formatting
- **CSV**: Header row detection, column mapping

---

## Typical Submission Package

A complete Workers Compensation submission typically includes:

1. **Email Body** - Submission narrative and broker notes
2. **Payroll Document(s)** - Payroll by class code and state (Excel or PDF)
3. **Questionnaire/Application** - Completed WC questionnaire or application (PDF or Word)
4. **Loss Runs** - Prior loss history (PDF or Excel)
5. **Experience Mod** - Current or prior experience modification factor (PDF)
6. **Supplemental Documents** - Additional supporting information (various formats)
7. **Schedules** - Officer schedules, employee rosters, location schedules (Excel)

---

## Notes

- **ACORD 130**: The system does NOT expect ACORD 130 forms as incoming documents. ACORD 130 is used as a target for pre-filling (output), not as a source document (input).
- **Multiple Documents**: The system can handle multiple documents of the same type (e.g., multiple loss runs, multiple payroll files).
- **Document Parsing**: All documents are parsed and their text content is made available to the LLM for field extraction.
- **Field Extraction**: The LLM uses the `whereToLook` field attribute to prioritize which document types to search for each field.
- **Fallback**: If a field is not found in the suggested documents (`whereToLook`), the LLM searches all available documents.

