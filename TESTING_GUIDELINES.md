# Testing Guidelines

## Database & Testing Constraints

### ⚠️ Cyrillic Names Only
**CRITICAL**: The database contains city/location names in **Cyrillic script only**.

When testing search functionality, always use Cyrillic names:
- ✅ **Пловдив** (not Plovdiv)
- ✅ **София** (not Sofia)
- ✅ All other Bulgarian city/location names in Cyrillic

❌ **DO NOT** use Latin/English transliterations for testing
✅ **ALWAYS** use Cyrillic names when testing search, filters, or location-based features

### Examples for Testing

```typescript
// ❌ WRONG - Latin names will not match database
searchLocation("Sofia");
searchLocation("Plovdiv");

// ✅ CORRECT - Cyrillic names
searchLocation("София");
searchLocation("Пловдив");
```

---

*Last updated: 2025-12-26*
