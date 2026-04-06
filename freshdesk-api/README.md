# freshdesk-api

Freshdesk helpdesk API skill for Claude Code — tickets, contacts, companies, knowledge base, webhooks, and automation.

## Skills

| Skill | Trigger |
|-------|---------|
| [`freshdesk-api`](skills/freshdesk-api/SKILL.md) | Working with Freshdesk API: tickets, contacts, knowledge base articles, webhooks |

## What It Covers

| Area | Capabilities |
|------|-------------|
| **Tickets** | Full CRUD, conversations, replies, notes, bulk updates, search |
| **Contacts & Companies** | Create, update, merge, export, search |
| **Knowledge Base** | Categories, folders, articles — create/update/publish/unpublish/search |
| **Agents & Groups** | List and manage support agents and groups |
| **Time Entries** | Track billable time on tickets |
| **Webhooks & Automation** | Set up event-driven workflows |
| **Search** | Unified search across tickets, contacts, companies, and KB articles |

## Reference Files

| File | Purpose |
|------|---------|
| [tickets-api.md](skills/freshdesk-api/references/tickets-api.md) | Ticket CRUD, conversations, bulk ops, search |
| [contacts-companies.md](skills/freshdesk-api/references/contacts-companies.md) | Contacts, companies, agents, groups |
| [solutions-api.md](skills/freshdesk-api/references/solutions-api.md) | Knowledge base: categories, folders, articles |
| [webhooks-automation.md](skills/freshdesk-api/references/webhooks-automation.md) | Webhooks and automation rules |
| [sdk-examples.md](skills/freshdesk-api/references/sdk-examples.md) | Python, Node.js, Ruby SDK examples |

## Installation

```
/plugin install freshdesk-api@skillforge
/reload-plugins
```

## Authentication

All API calls use HTTP Basic Auth — API key as username, `X` as password:

```bash
curl -s -u "$FRESHDESK_API_KEY:X" -H "Content-Type: application/json" \
  "https://yourcompany.freshdesk.com/api/v2/tickets"
```

Get your API key: Freshdesk → Profile Settings → API Key.
