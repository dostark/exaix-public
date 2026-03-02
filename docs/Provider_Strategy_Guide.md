# Provider Strategy Guide

## Overview

ExoFrame's Provider Strategy system enables intelligent, configuration-driven selection of LLM providers based on cost, performance, health, and task requirements. This guide explains how to configure and optimize provider selection for different use cases.

## Core Concepts

### Provider Selection Criteria

The system evaluates providers based on multiple factors:

- **Cost Preferences**: Free vs paid providers
- **Budget Constraints**: Daily spending limits
- **Task Complexity**: Simple vs complex tasks
- **Provider Health**: Real-time availability checks
- **Required Capabilities**: Specific model features needed

### Selection Algorithm

Providers are filtered and ranked using this optimized pipeline:

1. **Capabilities Filter** (Fastest) - Required features

1.
1.
1.

## Configuration

### Basic Provider Strategy

```toml
[provider_strategy]
# Prefer free providers when available
prefer_free = true
# Allow local providers (Ollama)
allow_local = true
# Maximum daily cost in USD
max_daily_cost_usd = 5.00
# Enable health checks before selection
health_check_enabled = true
# Enable fallback chains
fallback_enabled = true
```

### Task-Based Routing

Route specific task types to preferred providers:

```toml
[provider_strategy.task_routing]
# Simple tasks use fast, cheap models
simple = ["ollama", "openai-gpt-4o-mini", "google-gemini-flash"]
# Complex tasks use best available models
complex = ["anthropic-claude-opus", "openai-gpt-5-pro", "google-gemini-pro"]
# Code review tasks prefer specialized models
code_review = ["anthropic-claude-opus", "openai-gpt-5-pro"]
```

### Provider-Specific Budgets

Set individual budgets per provider:

```toml
[provider_strategy.budgets]
anthropic = 10.00
openai = 5.00
google = 2.00
ollama = 0.00  # Free
```

### Fallback Chains

Define fallback sequences when primary providers fail:

```toml
[provider_strategy.fallback_chains]
# Production chain: Best → Fast → Free
production = ["anthropic-claude-opus", "openai-gpt-5-pro", "google-gemini-pro", "ollama"]
# Budget chain: Free → Cheap → Local
budget = ["ollama", "google-gemini-flash", "openai-gpt-4o-mini"]
```

## Provider Configuration

### Provider Metadata Overrides

Override default provider settings:

```toml
[providers.anthropic]
cost_tier = "paid"
free_quota_requests_per_day = 0
timeout_ms = 60000

[providers.ollama]
cost_tier = "local"
base_url = "http://localhost:11434"
timeout_ms = 120000

[providers."openai-gpt-4o-mini"]
cost_tier = "freemium"
free_quota_requests_per_day = 100
```

## Common Scenarios

### Cost-Optimized Setup

```toml
[provider_strategy]
prefer_free = true
allow_local = true
max_daily_cost_usd = 2.00
health_check_enabled = true

[provider_strategy.task_routing]
simple = ["ollama", "google-gemini-flash"]
complex = ["google-gemini-pro", "openai-gpt-4o-mini"]
```

### Performance-First Setup

```toml
[provider_strategy]
prefer_free = false
allow_local = false
max_daily_cost_usd = 20.00
health_check_enabled = true

[provider_strategy.task_routing]
simple = ["openai-gpt-4o-mini", "google-gemini-flash"]
complex = ["anthropic-claude-opus", "openai-gpt-5-pro"]
```

### Hybrid Local-Cloud Setup

```toml
[provider_strategy]
prefer_free = true
allow_local = true
max_daily_cost_usd = 10.00

[provider_strategy.fallback_chains]
default = ["ollama", "google-gemini-flash", "anthropic-claude-sonnet"]

[providers.ollama]
cost_tier = "local"
timeout_ms = 120000
```

### Enterprise Setup

```toml
[provider_strategy]
prefer_free = false
max_daily_cost_usd = 50.00
health_check_enabled = true

[provider_strategy.budgets]
anthropic = 30.00
openai = 20.00

[provider_strategy.task_routing]
code_review = ["anthropic-claude-opus"]
planning = ["openai-gpt-5-pro"]
execution = ["anthropic-claude-sonnet"]
```

## Monitoring and Metrics

### Selection Metrics

The system tracks provider selection performance:

- Selection count per provider
- Average selection time
- Success/failure rates

### Health Monitoring

Provider health is cached for 60 seconds by default:

```toml
[health]
cache_ttl_ms = 60000  # 60 seconds
check_timeout_ms = 30000  # 30 seconds
```

### Cost Tracking

Batch cost updates every 5 seconds (max 50 records):

```toml
[cost_tracking]
batch_delay_ms = 5000
max_batch_size = 50
```

## Troubleshooting

### Common Issues

**No suitable provider found:**

- Check provider health status
- Verify budget constraints
- Ensure required capabilities are met

**Slow provider selection:**

- Review health check timeouts
- Check database performance
- Consider increasing cache TTL

**Unexpected provider selection:**

- Verify task routing configuration
- Check fallback chain ordering
- Review cost preferences

### Debug Configuration

Enable detailed logging:

```toml
[system]
log_level = "debug"
```

## Best Practices

1. **Start Simple**: Begin with basic cost preferences

1.
1.
1.
1.
1.

## API Reference

### SelectionCriteria Interface

```typescript
interface SelectionCriteria {
  preferFree?: boolean;
  maxCostUsd?: number;
  taskComplexity?: "simple" | "medium" | "complex";
  requiredCapabilities?: string[];
  allowLocal?: boolean;
}
```

### ProviderSelector Methods

- `selectProvider(criteria)` - Select based on criteria
- `selectProviderForTask(config, taskType)` - Config-driven selection
- `getSelectionMetrics()` - Get performance metrics</content>

