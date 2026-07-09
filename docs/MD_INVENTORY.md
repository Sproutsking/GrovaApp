# Markdown Files Inventory — Repo-wide

This inventory lists every `.md` file in the repository, a short purpose summary, and a recommended action (Keep / Review / Archive). Archiving is non-destructive — package the obsolete files into `docs/archived_docs.tar.gz` and remove the loose copies so the repo stays lean.

Run: `ls **/*.md` to refresh.


1. `README.md` — Project root README. Purpose: primary repo entry. **Action: KEEP**
2. `XEEVIA_MASTER_DOC.md` — Master implementation & handoff doc (this file). **Action: KEEP**
3. `XEEVIA_ARCHITECTURE_STRATEGY.md` — Strategic architecture and roadmap. **Action: KEEP**
4. `XEEVIA_ACTION_CHECKLIST.md` — Immediate action checklist. **Action: KEEP**
5. `XEEVIA_OVERVIEW.md` — High-level product overview and thesis. **Action: KEEP**
6. `XEEVIA_QUICK_START.md` — Onboarding checklist. **Action: KEEP**
7. `XEEVIA_COMPLETE_REFERENCE.md` — (Feature reference) REVIEW: confirm current relevance. **Action: REVIEW**
8. `XEEVIA_COMPLETE_REFERENCE.md` — duplicate names possible; check contents. **Action: REVIEW**
9. `APP_INVESTIGATION_REPORT.md` — Investigation notes. **Action: ARCHIVE** (operational, historical)
10. `IMPLEMENTATION_SUMMARY.md` — Implementation notes. **Action: KEEP (if concise)**
11. `FEATURES_IMPLEMENTATION.md` — Feature implementation details. **Action: REVIEW**
12. `MASSIVE_FEATURES_COMPLETED.md` — Large feature summary. **Action: ARCHIVE/REVIEW**
13. `DEPLOYMENT.md` — Deployment instructions. **Action: KEEP**
14. `DEPLOYMENT_WEB3_PHASE_1C.md` — Web3 deployment guidance. **Action: REVIEW**
15. `WEB3_PHASE_1C_COMPLETION.md` — Completion notes. **Action: ARCHIVE**
16. `WEB3_PAYMENT_SYSTEM_REFERENCE.md` — Payments reference. **Action: KEEP (payments team)**
17. `PAYWAVE_PHASE_4_COMPLETE.md` — Paywave feature doc. **Action: REVIEW (wallet team)**
18. `PAYWAVE_OPAY_FIXES.md` — Paywave fixes. **Action: REVIEW**
19. `PAYWAVE_DEPLOYMENT_GUIDE.md` — Paywave deployment. **Action: REVIEW**
20. `PAYWAVE_COMPLETE_INTEGRATION.md` — Paywave integration notes. **Action: REVIEW**
21. `PAYWAVE_DEPLOYMENT_GUIDE.md` — duplicate check, review. **Action: REVIEW**
22. `BOTTOM_NAV_PAYWAVE_DOM_APPROACH.md` — UI approach for Paywave. **Action: ARCHIVE/REVIEW**
23. `PR_CHECKLIST_PAYWAVE.md` — PR checklist for Paywave. **Action: ARCHIVE (procedural)**
24. `POSTFULLSCREEN_INTEGRATION.md` — Post fullscreen integration notes. **Action: REVIEW**
25. `INTEGRATION_GUIDE.md` — Integration guide. **Action: KEEP**
26. `HANDOFF_PHASE_1D.md` — Handoff notes. **Action: ARCHIVE (historical)
27. `PROJECT_MISSION.md` — Project mission statement. **Action: KEEP**
28. `PUSH_NOTIFICATION_TROUBLESHOOTING.md` — Troubleshooting guide. **Action: KEEP (ops)**
29. `OPAY_INTEGRATION.md` — OPay integration docs. **Action: REVIEW (payments)
30. `WITHDRAWAL_V2_README.md` — Withdrawal feature README. **Action: REVIEW**
31. `docs/HELP_FAQ.md` — User-facing FAQ. **Action: KEEP**
32. `docs/XEEVIA_MASTER_DOC.md` — Master doc (duplicate location). **Action: KEEP**
33. `src/services/distribution/README.md` — Service-level README. **Action: KEEP**
34. `supabase/functions/getCultureContent/README.md` — Edge function README. **Action: KEEP**


## Recommended next steps (automatable)
1. Package `ARCHIVE` candidates into a single artifact for safekeeping:

```bash
mkdir -p docs/archived_docs
tar -czf docs/archived_docs.tar.gz -C docs archived_docs/*.md
rm -f docs/archived_docs/*.md
rmdir docs/archived_docs
```

2. For each `REVIEW` item, open and confirm whether the content is still accurate; if not, either update or archive.
3. After archiving and review, commit changes and remove archived docs from the root to reduce noise.


## Automation note
I can create a script that:
- lists all `.md` files,
- opens each and extracts a one-line summary (first heading),
- stages recommended moves into `docs/archived_docs/` for your review.

Run this helper (I can create it next) to semi-automate the cleanup.

End of inventory.
