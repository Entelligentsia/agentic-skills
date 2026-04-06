# Solutions (Knowledge Base) API Reference

Complete reference for Freshdesk Solutions API v2 — manage help center categories, folders, and articles.

## Data Model

The knowledge base is organised in three levels:

```
Category  (top-level grouping, e.g. "Getting Started")
  └── Folder  (section within a category, e.g. "Account Setup")
        └── Article  (individual help article)
```

Each level is scoped to a **portal** (your help center). Multi-product accounts have one portal per product.

---

## Category Object

```json
{
  "id": 1,
  "name": "Getting Started",
  "description": "Guides for new users",
  "portal_id": 1,
  "position": 1,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-12-01T14:30:00Z"
}
```

---

## Folder Object

```json
{
  "id": 10,
  "name": "Account Setup",
  "description": "How to set up and configure your account",
  "category_id": 1,
  "position": 1,
  "visibility": 1,
  "articles_count": 5,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-12-01T14:30:00Z"
}
```

### Folder Visibility Values

| Value | Visibility |
|-------|-----------|
| 1 | All visitors (public) |
| 2 | Logged-in users only |
| 3 | Agents only |
| 4 | Selected companies only |

---

## Article Object

```json
{
  "id": 100,
  "title": "How to reset your password",
  "description": "<p>Follow these steps to reset your password...</p>",
  "description_text": "Follow these steps to reset your password...",
  "status": 2,
  "type": 1,
  "category_id": 1,
  "folder_id": 10,
  "hits": 1234,
  "thumbs_up": 45,
  "thumbs_down": 3,
  "suggested": 12,
  "feedback_count": 2,
  "tags": ["password", "account", "login"],
  "seo_data": {
    "meta_title": "How to Reset Your Password | Help Center",
    "meta_description": "Step-by-step guide to resetting your password"
  },
  "author_id": 12,
  "created_at": "2024-01-20T10:00:00Z",
  "updated_at": "2024-12-01T14:30:00Z"
}
```

### Article Status Values

| Value | Status |
|-------|--------|
| 1 | Draft |
| 2 | Published |

### Article Type Values

| Value | Type |
|-------|------|
| 1 | Permanent |
| 2 | Workaround |

---

## Categories

### List Categories

```
GET /api/v2/solutions/categories
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories"
```

### Get Category

```
GET /api/v2/solutions/categories/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/1"
```

### Create Category

```
POST /api/v2/solutions/categories
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "solution_category": {
      "name": "Billing & Payments",
      "description": "Guides for subscription management and invoicing"
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories"
```

### Update Category

```
PUT /api/v2/solutions/categories/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "solution_category": {
      "name": "Billing & Payments",
      "description": "Updated description"
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/1"
```

### Delete Category

```
DELETE /api/v2/solutions/categories/{id}
```

**Warning**: Deletes all folders and articles within the category.

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -X DELETE \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/1"
```

---

## Folders

### List Folders in Category

```
GET /api/v2/solutions/categories/{category_id}/folders
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/1/folders"
```

### Get Folder

```
GET /api/v2/solutions/folders/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10"
```

### Create Folder

```
POST /api/v2/solutions/categories/{category_id}/folders
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "solution_folder": {
      "name": "Getting Paid",
      "description": "Payouts, withdrawals, and payment methods",
      "visibility": 1
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/1/folders"
```

### Update Folder

```
PUT /api/v2/solutions/folders/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "solution_folder": {
      "name": "Payouts & Withdrawals",
      "visibility": 2
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10"
```

### Delete Folder

```
DELETE /api/v2/solutions/folders/{id}
```

**Warning**: Deletes all articles within the folder.

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -X DELETE \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10"
```

---

## Articles

### List Articles in Folder

```
GET /api/v2/solutions/folders/{folder_id}/articles
```

```bash
# List all articles in a folder
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10/articles"

# With pagination
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10/articles?page=2&per_page=30"
```

### Get Article

```
GET /api/v2/solutions/articles/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100"
```

### Create Article

```
POST /api/v2/solutions/folders/{folder_id}/articles
```

```bash
# Create a draft article
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "solution_article": {
      "title": "How to cancel your subscription",
      "description": "<p>To cancel your subscription, follow these steps:</p><ol><li>Go to <strong>Account Settings</strong></li><li>Click <strong>Billing</strong></li><li>Select <strong>Cancel Plan</strong></li></ol>",
      "status": 1,
      "type": 1,
      "tags": ["cancel", "subscription", "billing"]
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10/articles"

# Create and immediately publish
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "solution_article": {
      "title": "Getting started with virtual tours",
      "description": "<p>Welcome to our platform! This guide walks you through creating your first virtual tour.</p>",
      "status": 2,
      "type": 1,
      "tags": ["getting-started", "tours", "tutorial"],
      "seo_data": {
        "meta_title": "Getting Started with Virtual Tours | Help Center",
        "meta_description": "Step-by-step guide to creating your first virtual tour"
      }
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10/articles"
```

### Update Article

```
PUT /api/v2/solutions/articles/{id}
```

```bash
# Update content
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "solution_article": {
      "title": "How to cancel your subscription (updated)",
      "description": "<p>Updated cancellation steps...</p>",
      "tags": ["cancel", "subscription", "billing", "refund"]
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100"

# Publish a draft
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "solution_article": {
      "status": 2
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100"

# Unpublish (revert to draft)
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "solution_article": {
      "status": 1
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100"
```

### Delete Article

```
DELETE /api/v2/solutions/articles/{id}
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  -X DELETE \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100"
```

---

## Search Articles

Search the knowledge base for articles matching a query.

```
GET /api/v2/search/solutions?term={term}
```

```bash
# Search articles
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/search/solutions?term=password+reset"

# Search with language filter
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/search/solutions?term=billing&language=en"
```

### Response

```json
{
  "results": [
    {
      "id": 100,
      "title": "How to reset your password",
      "description_text": "Follow these steps to reset...",
      "status": 2,
      "folder_id": 10,
      "category_id": 1,
      "hits": 1234
    }
  ]
}
```

---

## Article Feedback

Retrieve customer feedback (thumbs up/down) on articles.

### List Article Feedback

```
GET /api/v2/solutions/articles/{id}/feedback
```

```bash
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100/feedback"
```

### Response

```json
[
  {
    "id": 1,
    "article_id": 100,
    "helpful": false,
    "note": "The steps were outdated",
    "created_at": "2024-12-01T10:00:00Z"
  }
]
```

---

## Common Workflows

### List the Full Knowledge Base Structure

```bash
#!/usr/bin/env bash
# Dump all categories → folders → article titles

categories=$(curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories")

echo "$categories" | jq -r '.[] | "\(.id) \(.name)"' | while IFS=' ' read -r cat_id cat_name; do
  echo "=== $cat_name ==="

  folders=$(curl -s -u "$FRESHDESK_API_KEY:X" \
    "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/$cat_id/folders")

  echo "$folders" | jq -r '.[] | "  [\(.id)] \(.name) (\(.articles_count) articles)"' | while IFS= read -r line; do
    echo "$line"
    folder_id=$(echo "$line" | grep -oP '\[\K[0-9]+')
    articles=$(curl -s -u "$FRESHDESK_API_KEY:X" \
      "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/$folder_id/articles")
    echo "$articles" | jq -r '.[] | "    - [\(.id)] \(.title) (status:\(.status))"'
    sleep 0.2
  done
done
```

### Find and Update Stale Articles

```bash
#!/usr/bin/env bash
# List published articles not updated in 180+ days

cutoff=$(date -d '180 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -v-180d +%Y-%m-%dT%H:%M:%SZ)

categories=$(curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories")

echo "$categories" | jq -r '.[].id' | while read -r cat_id; do
  folders=$(curl -s -u "$FRESHDESK_API_KEY:X" \
    "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/$cat_id/folders")

  echo "$folders" | jq -r '.[].id' | while read -r folder_id; do
    articles=$(curl -s -u "$FRESHDESK_API_KEY:X" \
      "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/$folder_id/articles")

    echo "$articles" | jq -r \
      --arg cutoff "$cutoff" \
      '.[] | select(.status == 2 and .updated_at < $cutoff) | "\(.id)\t\(.updated_at)\t\(.title)"'

    sleep 0.2
  done
done
```

### Bulk Publish Draft Articles

```bash
#!/usr/bin/env bash
# Publish all drafts in a specific folder

folder_id=10

drafts=$(curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/$folder_id/articles" \
  | jq -r '.[] | select(.status == 1) | .id')

for id in $drafts; do
  echo "Publishing article $id..."
  curl -s -u "$FRESHDESK_API_KEY:X" \
    -H "Content-Type: application/json" \
    -X PUT \
    -d '{"solution_article": {"status": 2}}' \
    "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/$id"
  sleep 0.3
done

echo "Done."
```

### Export All Articles to JSON

```bash
#!/usr/bin/env bash
# Export full knowledge base content to kb_export.json

output="[]"

categories=$(curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories")

echo "$categories" | jq -r '.[].id' | while read -r cat_id; do
  folders=$(curl -s -u "$FRESHDESK_API_KEY:X" \
    "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/categories/$cat_id/folders")

  echo "$folders" | jq -r '.[].id' | while read -r folder_id; do
    articles=$(curl -s -u "$FRESHDESK_API_KEY:X" \
      "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/$folder_id/articles")

    # Fetch full content for each article
    echo "$articles" | jq -r '.[].id' | while read -r art_id; do
      curl -s -u "$FRESHDESK_API_KEY:X" \
        "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/$art_id" \
        >> /tmp/kb_articles.jsonl
      echo "" >> /tmp/kb_articles.jsonl
      sleep 0.2
    done
  done
done

# Combine into array
jq -s '.' /tmp/kb_articles.jsonl > kb_export.json
echo "Exported to kb_export.json"
```

### Create Article from Ticket Resolution

```bash
#!/usr/bin/env bash
# Turn a resolved ticket into a draft KB article

ticket_id=$1
folder_id=$2

# Fetch ticket details
ticket=$(curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/tickets/$ticket_id?include=conversations")

title=$(echo "$ticket" | jq -r '.subject')
description=$(echo "$ticket" | jq -r '.description')

curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "$(jq -n \
    --arg title "How to: $title" \
    --arg description "$description" \
    '{solution_article: {title: $title, description: $description, status: 1, type: 1}}')" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/$folder_id/articles"

echo "Draft article created from ticket $ticket_id"
```

---

## Request/Response Envelope

The Solutions API wraps request bodies and response objects in a `solution_*` envelope:

| Resource | Request Key | Response is |
|----------|-------------|-------------|
| Category | `solution_category` | Plain object |
| Folder | `solution_folder` | Plain object |
| Article | `solution_article` | Plain object |

**Note**: List endpoints return a plain JSON array (no envelope). Single-resource GET/POST/PUT responses return the object directly (no envelope).

---

## Multilingual Knowledge Base

For accounts with multiple languages enabled, append `?language=<locale>` to article endpoints.

```bash
# Get article in French
curl -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/articles/100?language=fr"

# Create article in Spanish
curl -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "solution_article": {
      "title": "Cómo cancelar su suscripción",
      "description": "<p>Para cancelar su suscripción...</p>",
      "status": 2
    }
  }' \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/solutions/folders/10/articles?language=es"
```

Common locale codes: `en` (English), `fr` (French), `de` (German), `es` (Spanish), `pt` (Portuguese), `nl` (Dutch), `ja` (Japanese), `zh-CN` (Simplified Chinese).

---

## Rate Limit Notes

- Each article fetch counts as 1 API credit
- Fetching full article content separately (after listing) doubles your credit usage for bulk exports — batch carefully
- Use `per_page=100` on list endpoints to minimise pagination calls
