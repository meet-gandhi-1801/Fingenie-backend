# Financial Document Ingestion & Transaction Extraction Engine

## 1. Files Created / Modified
**Created:**
- `models/ImportJob.js`: Mongoose model tracking async job state.
- `jobs/importWorker.js`: BullMQ worker running background document ingestion.
- `jobs/importQueue.js`: BullMQ queue configuration.
- `controllers/importController.js`: Endpoints handling upload, status-check, and review confirmations.
- `routes/importRoutes.js`: Exposes new API routes.
- `services/document-import/extractors/pdfTextExtractor.js`: Extracts code from text-heavy PDFs using `pdf-parse`.
- `services/document-import/extractors/imageExtractor.js`: Fallback generic OCR using Gemini.
- `services/document-import/transactionCandidateExtractor.js`: Rule-based extraction (dates, basic filtering) to create short candidates.
- `services/document-import/llmNormalizer.js`: Generative AI structured normalization of the candidate batch.
- `services/document-import/validationLayer.js`: Deterministic validation rules.
- `services/document-import/duplicateDetection.js`: Cryptographic deterministic generation and filter against duplicates.
- `services/document-import/balanceValidation.js`: Overall statement-level validation against computed transaction delta.
- `tests/document-import/validationLayer.test.js`: Unit tests for transaction evaluation rules.
- `tests/document-import/balanceValidation.test.js`: Unit tests for balance matching logic.

**Modified:**
- `models/Transaction.js`: Added unique `fingerprint` property and `'bank_statement'` enum to `source` for reliable deduplication.
- `server.js`: Mapped routes and initialized worker upon server start.
- `middleware/uploadMiddleware.js`: Whitelisted image mimetypes (`image/png`, `jpeg`).

---

## 2. API Endpoints
**POST `- /api/transactions/import`** \
Requires Multipart/form-data with `statement` file field (supports `pdf`, `png`, `jpg`). Responds instantly with a queued `jobId`.

**GET `- /api/transactions/import/:jobId`** \
Returns current job queue progress. If `"status": "review_required"`, returns array of validation-flagged `transactions` containing `requiresReview` flags.

**POST `- /api/transactions/import/:jobId/confirm`** \
Takes body `{ "transactions": [{ editedTx... }] }` allowing frontend to send the user-reviewed transactions. Triggers insertion, clears internal queue state, and kicks off downstream Insight generation.

---

## 3. Environment Variables Required
The feature maps exactly with the platform's existing variables. Ensure that:
- `GEMINI_API_KEY`: Used as normalizer + OCR.
- `REDIS_URL`: BullMQ async queuing (defaults to `redis://127.0.0.1:6379`).

---

## 4. Packages or Dependencies Added
- Used existing repo standard elements (`@google/generative-ai`, `pdf-parse`, `mongoose`, `bullmq`, `ioredis`).
- Installed `jest` for testing environments.

---

## 5. Database Schema Changes
`Transaction`: 
Added `source: 'bank_statement'`.
Added `fingerprint`: String (unique, sparse). Crucial for rejecting uploaded duplicates natively at MongoDB scale.

`ImportJob`:
New schema storing metadata, async lifecycle status (`queued`, `processing`, `review_required`, `completed`), and processed buffers.

---

## 6. BullMQ Jobs / Workers Added
- **Queue**: `document-import` (managed in `importQueue.js`)
- **Worker**: `importWorker.js`. 
Offloads massive unstructured conversions to an unblocking state machine flow (Extraction -> Candidates -> LLM Formatting -> Deterministic Math -> Reviewing -> Storage).

---

## 7. LLM Prompt / Schema
Located in `services/document-import/llmNormalizer.js`. We tell `gemini-1.5-flash`:
> "You are a financial transaction normalizer... Convert them strictly to JSON formats. Do not invent transactions, preserve amounts."
Structured output is expected to follow this map:
```json
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 100,
      "type": "debit" | "credit",
      "merchant": "Normalized Merchant",
      "category": "Category from predefined strict enum",
      "confidence": 0.95
    }
  ]
}
```

---

## 8. Extract Pipeline 
```mermaid
PDF -> pdfParse (isScanned? -> Gemini OCR fallback) -> Regex Candidate Detection -> Chunking into LLM Normalizer Batches -> Deterministic Validation Maps (Math/Date) -> Ledger Balance Test -> Hashing Deduplication -> Saved in ImportJob State.
```
- A strict rule of `No Direct Document Feed` applies. Gemini only processes small line-batches that *look like* transactions during its normalization pass to avoid huge token costs on 20+ page statements.

---

## 9. How to run it locally
Make sure your existing Redis container is online (since it uses BullMQ). \
`npm run dev` 

The BullMQ workers attach seamlessly onto the Node `server.js` run (like `insightWorker.js`), monitoring for statement-documents off Redis.

---

## 10. Example API Request (Initiate Pipeline)
`curl -X POST http://localhost:5000/api/transactions/import \`
`-H "Authorization: Bearer <token>" \`
`-F "statement=@january_txns.pdf"`

---

## 11. Example Successful Response (Status Polling)
GET to `/api/transactions/import/<jobId>`
```json
{
  "success": true,
  "job": {
    "status": "completed",
    "progress": 100,
    "transactionsFound": 45,
    "transactionsSkipped": 3,
    "requiresReview": 0
  }
}
```

---

## 12. Example Low-Confidence Review Response
```json
{
  "success": true,
  "job": {
    "status": "review_required",
    "requiresReview": 2,
    "transactions": [
       {
         "date": "2026-09-02",
         "amount": 149.99,
         "type": "debit",
         "merchant": "Swiggy",
         "confidence": 0.91,
         "requiresReview": false,
         "isValid": true
       },
       {
         "date": "2026-09-05",
         "amount": null,
         "type": "credit",
         "merchant": "Unrecognized Terminal",
         "confidence": 0.35,
         "requiresReview": true,
         "validationError": "Statement balance check failed | Invalid amount"
       }
    ]
  }
}
```

---

## 13. Test Results
Jest tests were successfully implemented for:
1. `validationLayer.test.js`: Catching anomalous numbers natively without needing LLM inferences, successfully defaulting undefined categories to 'Other'.
2. `balanceValidation.test.js`: Confirmed diff calculations block ingestion when internal document logic doesn't scale properly.

---

## 14. Known Limitations
- Pure tabular PDF conversions (without spaces padding) could sometimes break `pdf-parse` extraction and trigger the OCR fallback, adding to latency.
- In-memory `buffer.toString('base64')` pipeline inside Redis might trigger large payload limits if the PDF file is absurdly huge (100MB+). Standard constraints (10MB) prevent Redis RAM blowouts inside the `uploadMiddleware`.
- Due to strict Gemini rate limit considerations, heavy batched concurrent document queues may face transient blocks handled by Backoff BullMQ retries.
