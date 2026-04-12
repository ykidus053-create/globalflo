import json
import os
from typing import Any, Dict, List


def _resolve_url(connector: Dict[str, Any]) -> str:
    env_key = connector.get("env_key")
    if env_key:
        env_value = os.environ.get(env_key)
        if env_value:
            return env_value
    return connector["default_url"]


def _sample_message_text(value: Any) -> str:
    if isinstance(value, dict):
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    return str(value)


def _build_connector(definition: Dict[str, Any]) -> Dict[str, Any]:
    connector = dict(definition)
    connector["resolved_url"] = _resolve_url(connector)
    connector["sample_message_text"] = _sample_message_text(connector.get("sample_message", ""))
    connector["configured"] = bool(connector.get("env_key") and os.environ.get(str(connector["env_key"]), "").strip())
    return connector


CONNECTORS: List[Dict[str, Any]] = [
    _build_connector(
        {
            "id": "zapier",
            "name": "Zapier",
            "description": "Plug GlobalFlow into 1,000+ apps instantly with trigger/action automation.",
            "default_url": "https://hooks.zapier.com/hooks/catch/123456/abcde",
            "env_key": "GLOBALFLOW_ZAPIER_WEBHOOK",
            "sample_field": "event",
            "sample_message": "billing.run.completed",
            "doc": "https://zapier.com/developer",
            "category": "automation",
            "capability": "Lets GlobalFlow plug into 1000+ tools instantly",
            "health_method": "POST",
            "dispatch_method": "POST",
        }
    ),
    _build_connector(
        {
            "id": "make",
            "name": "Make (Integromat)",
            "description": "Run multi-step low-code scenarios with branching and retries.",
            "default_url": "https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxx",
            "env_key": "GLOBALFLOW_MAKE_WEBHOOK",
            "sample_field": "event",
            "sample_message": "ops.orchestration.synced",
            "doc": "https://www.make.com/en/help",
            "category": "automation",
            "capability": "Lets GlobalFlow plug into 1000+ tools instantly",
            "health_method": "POST",
            "dispatch_method": "POST",
        }
    ),
    _build_connector(
        {
            "id": "snowflake",
            "name": "Snowflake",
            "description": "Send structured automation telemetry to enterprise data warehousing.",
            "default_url": "https://example-account.snowflakecomputing.com/api/v2/statements",
            "env_key": "GLOBALFLOW_SNOWFLAKE_ENDPOINT",
            "sample_field": "sqlText",
            "sample_message": "select current_timestamp()",
            "doc": "https://docs.snowflake.com/en/developer-guide/sql-api/intro",
            "category": "data-warehouse",
            "capability": "Deep analysis, predictive modeling, enterprise scalability",
            "health_method": "POST",
            "dispatch_method": "POST",
        }
    ),
    _build_connector(
        {
            "id": "bigquery",
            "name": "BigQuery",
            "description": "Export workflow outcomes for advanced analytics and ML pipelines.",
            "default_url": "https://bigquery.googleapis.com/bigquery/v2/projects/project-id/jobs",
            "env_key": "GLOBALFLOW_BIGQUERY_ENDPOINT",
            "sample_field": "jobReference",
            "sample_message": {"projectId": "project-id"},
            "doc": "https://cloud.google.com/bigquery/docs/reference/rest",
            "category": "data-warehouse",
            "capability": "Deep analysis, predictive modeling, enterprise scalability",
            "health_method": "POST",
            "dispatch_method": "POST",
        }
    ),
    _build_connector(
        {
            "id": "cloudwatch",
            "name": "AWS CloudWatch",
            "description": "Publish logs and metrics for operational monitoring and alerting.",
            "default_url": "https://monitoring.amazonaws.com/",
            "env_key": "GLOBALFLOW_CLOUDWATCH_ENDPOINT",
            "sample_field": "Action",
            "sample_message": "ListMetrics",
            "doc": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/Welcome.html",
            "category": "security-logs",
            "capability": "System monitoring and anomaly detection",
            "health_method": "GET",
            "dispatch_method": "GET",
        }
    ),
    _build_connector(
        {
            "id": "datadog",
            "name": "Datadog",
            "description": "Stream service checks and events into centralized observability dashboards.",
            "default_url": "https://api.datadoghq.com/api/v1/validate",
            "env_key": "GLOBALFLOW_DATADOG_ENDPOINT",
            "sample_field": "title",
            "sample_message": "GlobalFlow connector validation",
            "doc": "https://docs.datadoghq.com/api/latest/",
            "category": "security-logs",
            "capability": "System monitoring and anomaly detection",
            "health_method": "GET",
            "dispatch_method": "GET",
        }
    ),
    _build_connector(
        {
            "id": "meta-ads",
            "name": "Meta Ads",
            "description": "Send conversion signals to improve campaign optimization and attribution.",
            "default_url": "https://graph.facebook.com/v20.0/act_123456789/campaigns",
            "env_key": "GLOBALFLOW_META_ADS_ENDPOINT",
            "sample_field": "name",
            "sample_message": "GlobalFlow conversion sync",
            "doc": "https://developers.facebook.com/docs/marketing-apis",
            "category": "marketing",
            "capability": "Campaign optimization and ROI analysis",
            "health_method": "GET",
            "dispatch_method": "POST",
        }
    ),
    _build_connector(
        {
            "id": "google-ads",
            "name": "Google Ads",
            "description": "Sync conversion and spend signals to improve ROI visibility.",
            "default_url": "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
            "env_key": "GLOBALFLOW_GOOGLE_ADS_ENDPOINT",
            "sample_field": "customer_id",
            "sample_message": "1234567890",
            "doc": "https://developers.google.com/google-ads/api/docs/start",
            "category": "marketing",
            "capability": "Campaign optimization and ROI analysis",
            "health_method": "GET",
            "dispatch_method": "GET",
        }
    ),
]

CONNECTOR_LOOKUP: Dict[str, Dict[str, Any]] = {connector["id"]: connector for connector in CONNECTORS}
