# BUG-010: Failed attachment audit leaves duplicate file records

## Severity

High - retrying an upload after an audit failure creates duplicate attachment records.

## Root Cause

Attachment insert and audit-event insert used separate auto-committed queries.

## Fix

Lock the owned order and commit attachment content plus its audit event in one database transaction. Roll back both on any failure.

## Evidence

- Database verification found two records after one retry.
- Post-fix browser and database verification confirm one atomic file/audit pair per upload.