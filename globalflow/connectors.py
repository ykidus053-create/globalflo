from typing import Dict, List

CONNECTORS: List[Dict[str, str]] = [
    {
        "id": "slack",
        "name": "Slack Alert",
        "description": "Fire a secure webhook that pings your Slack channel with the latest status summary.",
        "default_url": "https://httpbin.org/post",
        "sample_field": "message",
        "sample_message": "GlobalFlow just completed a billing cycle.",
    },
    {
        "id": "crm",
        "name": "CRM Sync",
        "description": "Push new automation outcomes into your CRM (HubSpot/Salesforce) via a REST API stub.",
        "default_url": "https://httpbin.org/post",
        "sample_field": "record",
        "sample_message": "New revenue captured from automation call flow.",
    },
    {
        "id": "billing",
        "name": "Accounting Webhook",
        "description": "Notify QuickBooks/NetSuite when reconciliation completes, including the settlement reference.",
        "default_url": "https://httpbin.org/post",
        "sample_field": "invoice_id",
        "sample_message": "GLFLOW-689 automation billing complete.",
    },
]

CONNECTOR_LOOKUP: Dict[str, Dict[str, str]] = {connector["id"]: connector for connector in CONNECTORS}
