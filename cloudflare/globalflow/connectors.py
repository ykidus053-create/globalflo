import os
from typing import Dict, List

def _resolve_url(connector: Dict[str, str]) -> str:
    env_key = connector.get("env_key")
    if env_key:
        env_value = os.environ.get(env_key)
        if env_value:
            return env_value
    return connector["default_url"]


CONNECTORS: List[Dict[str, str]] = [
    {
        "id": "slack",
        "name": "Slack Alert",
        "description": "Post automation summaries, anomalies, and approvals straight into a Slack channel.",
        "default_url": "https://hooks.example.com/slack/globalflow",
        "env_key": "GLOBALFLOW_SLACK_WEBHOOK",
        "sample_field": "text",
        "sample_message": "GlobalFlow finished a billing automation – review the results in Prefect.",
        "doc": "https://api.slack.com/messaging/webhooks",
        "category": "collaboration",
        "icon": "slack",
    },
    {
        "id": "hubspot",
        "name": "HubSpot CRM",
        "description": "Create or update deals and contacts with the automation outcome metadata.",
        "default_url": "https://api.hubapi.com/crm/v3/objects/deals",
        "env_key": "GLOBALFLOW_HUBSPOT_WEBHOOK",
        "sample_field": "properties",
        "sample_message": {
            "stage": "automation complete",
            "amount": "12500",
        },
        "doc": "https://developers.hubspot.com/docs/api/crm/deals",
        "category": "crm",
        "icon": "hubspot",
    },
    {
        "id": "quickbooks",
        "name": "QuickBooks Sync",
        "description": "Send reconciliation and invoice metadata into QuickBooks Online for downstream finance teams.",
        "default_url": "https://api.intuit.com/v3/company/1234567890/payment",
        "env_key": "GLOBALFLOW_QUICKBOOKS_WEBHOOK",
        "sample_field": "invoice_id",
        "sample_message": "GLFLOW-689 reconciliation processed",
        "doc": "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used",
        "category": "finance",
        "icon": "quickbooks",
    },
    {
        "id": "airtable",
        "name": "Airtable Sync",
        "description": "Stream updates into Airtable bases for ops teams that track statuses visually.",
        "default_url": "https://api.airtable.com/v0/appXXXXXXXXX/GlobalFlow",
        "env_key": "GLOBALFLOW_AIRTABLE_WEBHOOK",
        "sample_field": "fields",
        "sample_message": {
            "Name": "GlobalFlow billing automation",
            "Status": "Complete",
        },
        "doc": "https://airtable.com/api",
        "category": "process",
        "icon": "airtable",
    },
]

for connector in CONNECTORS:
    connector["resolved_url"] = _resolve_url(connector)

CONNECTOR_LOOKUP: Dict[str, Dict[str, str]] = {connector["id"]: connector for connector in CONNECTORS}
