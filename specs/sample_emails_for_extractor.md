# Sample Emails for the Extractor

These are realistic test cases for the AI extractor. Jim should send back 2–3 **real** emails for each category (redact anything sensitive). The samples below show the kinds of formats the extractor needs to handle — they double as the dev's day-1 test fixtures.

---

## Customer quote-request emails

The extractor parses these into a draft quote. Test goal: extract part number, qty, and any cross-reference notes for every line.

### Example A — Clean table format (easy case)

From: john.smith@acme.com

To: quotes@caphardware.com

Subject: RFQ — fasteners for May build run

Hi Jim,

Need a quote on the following for delivery by end of month:

Part Number         Qty

7555                500

M6-25-SS            1000

1/4-20 NY LOCK NUT  500

Standard terms. Let me know lead time when you have a chance.

Thanks,

John Smith

Purchasing — ACME Manufacturing

(555) 444-1234

**Expected extraction:**

- `customer_hint`: "ACME Manufacturing"  
- Line 1: `part_number_guess: "7555"` (ACME's PN — should match alias → HCS-04C-3000G8Y), qty: 500  
- Line 2: `part_number_guess: "M6-25-SS"`, qty: 1000  
- Line 3: `part_number_guess: "1/4-20 NY LOCK NUT"` (description-only), qty: 500

---

### Example B — Informal prose (medium case)

From: mike@reliabletools.com

To: quotes@caphardware.com

Subject: quick quote please

Jim,

Hope you're doing well. Customer just walked in needing the following:

About 200 of those 3/8" hex bolts grade 5 in the 2 inch length, plus matching nuts and washers (200 each). Also need 50 of the M8 socket head caps in 30mm — the stainless ones you sent us last time. 

Same pricing tier as our March order if possible. Need it priced today.

Mike

Reliable Tools

**Expected extraction:**

- `customer_hint`: "Reliable Tools"  
- Line 1: description "3/8" hex bolt grade 5 x 2"", qty 200, confidence \~0.6 (no PN)  
- Line 2: description "3/8" hex nut", qty 200, confidence \~0.5  
- Line 3: description "3/8" washer", qty 200, confidence \~0.5  
- Line 4: description "M8 socket head cap screw 30mm stainless", qty 50, confidence \~0.7

All of these should route to the **review queue** because confidence is low and no part numbers were given. User picks the right CAP PN for each in the UI.

---

### Example C — Forwarded customer PO (hard case)

From: dispatch@globalfastenermfg.com

To: quotes@caphardware.com

Subject: Fwd: PO 88421 — please quote

\---------- Forwarded message \---------

From: Sarah Chen \<sarah.chen@buyerco.com\>

To: dispatch@globalfastenermfg.com

Subject: PO 88421

Please find attached our blanket PO covering the parts below. Need pricing 

on all line items before we can release.

   ITEM   QTY    PART\#               DESC

   001    2500   GFM-HCS-516-3-G8    HEX CAP SCREW 5/16-18 X 3" GR8

   002    2500   GFM-NUT-516-NY      NYLON LOCK NUT 5/16-18

   003     500   GFM-FW-516-SAE      FLAT WASHER 5/16 SAE

   004    1000   GFM-LW-516-MED      LOCK WASHER 5/16 MEDIUM SPLIT

Send pricing per piece and confirm lead time.

Sarah Chen | Buyer | BuyerCo

**Expected extraction:** parse the forwarded body, ignore the email chain headers, extract 4 lines with GFM-prefixed part numbers. Customer hint: "BuyerCo" (the end customer, not the forwarder). High confidence on each line.

---

## Vendor reply emails

The extractor parses these into `vendor_quotes` records, attached to whichever parts they reference. Test goal: extract vendor name, part, qty, unit price, lead time.

### Example D — Vendor reply in body (easy case)

From: sales@abcmanufacturing.com

To: jim@caphardware.com

Subject: RE: pricing request — your PN HCS-04C-3000G8Y

Jim,

Here's our pricing on the screws you asked about:

HCS-04C-3000G8Y (our PN 7555):

  100-499:   $0.22 each

  500-999:   $0.18 each

  1000+:     $0.16 each

Stock: 8,500 on hand, ships same day for orders placed before 2pm PT.

Lead time on backorder: 7-10 days.

Let me know if you want to lock in pricing.

Steve

ABC Manufacturing

**Expected extraction:**

- vendor: "ABC Manufacturing"  
- part: `HCS-04C-3000G8Y` (cross-ref to alias `7555`)  
- 3 tiered records: qty 100/500/1000, unit\_price $0.22/$0.18/$0.16  
- lead\_time\_days: 0 in-stock, 7–10 backorder (capture as note)

---

### Example E — "See attached" with no inline data (hard case)

From: pricing@acmetrading.com

To: jim@caphardware.com

Subject: RE: RFQ 5/12

Jim,

Please find our quote attached. Pricing held for 14 days.

Best,

Carla

ACME Trading

**Expected behavior:** body extraction produces low-confidence / empty result. System pivots to the attachment (PDF) and runs the PDF extractor on it. Whatever the PDF says gets logged as the vendor quote.

This is why the PDF/Excel extractors exist — many vendors put pricing in attachments only.

---

### Example F — Excel attachment cited in body (medium case)

From: quotes@bigboltco.com

To: jim@caphardware.com

Subject: BBC Quote 24-5510

Jim — quote attached as Excel. Highlights:

\- Most items priced for 1000+ tier

\- Items marked "MTO" are made to order, 4-6 wk LT

\- Items marked "IS" are in stock

Call if you need anything expedited.

Tom — Big Bolt Co.

**Expected behavior:** body provides context ("MTO" / "IS" abbreviation hints) but data is in the Excel. The Excel extractor parses the attached spreadsheet, the body context can be passed in as a hint to improve confidence on the lead-time column.

---

## Notes for the dev (and for Jim if reviewing)

- These six examples are deliberately a mix of clean and messy. The extractor must handle clean cases with high confidence (≥0.85) and route messy ones to the review queue with a clear "needs PN match" reason rather than guessing.  
- The review queue UI is what makes 80%-accuracy extraction feel like 100%-accuracy to Jim's team — they just confirm/correct each row, much faster than typing from scratch.  
- When Jim sends real samples, include at least: 1 clean tabular customer email, 1 messy prose customer email, 1 forwarded PO, 1 vendor reply in body, 1 vendor "see attached" PDF, 1 vendor Excel attachment.

