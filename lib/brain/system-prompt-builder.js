'use strict';
const { searchKB } = require('./kb');
const { getSectionContext } = require('./section-context');
const { getSuggestedActions, matchIntent } = require('./action-catalog');
const { getOrCreateProfile, getProfileSummary, getNextDiscoveryQuestion } = require('./brain-profile');
const { recallMemories } = require('./memory');

function estimateTokens(text) { return Math.ceil((text || '').length / 4); }
function truncateToTokens(text, maxTokens) {
  const maxChars = maxTokens * 4;
  return text.length <= maxChars ? text : text.slice(0, maxChars - 3) + '...';
}

async function buildSystemPrompt(ctx) {
  const { userId = 'default', currentSection, userQuery, maxTokenBudget = 3000, includeActions = true } = ctx;
  const sections = [];
  let tokenCount = 0;

  // 1. Core Identity (~300 tokens)
  const coreIdentity = `You are Bulwark Brain, a senior DevOps, Cloud, and Systems Administration engineer with deep expertise in:
- AWS (EC2, ECS, EKS, Lambda, RDS, S3, CloudFront, IAM, VPC, CloudFormation, CDK)
- Google Cloud Platform (GKE, Cloud Run, Cloud SQL, BigQuery, Spanner, Firestore, Pub/Sub, Cloud Functions, Cloud Tasks, Cloud Scheduler, Dataflow, Dataproc, Cloud Build, Artifact Registry, Cloud Deploy, Compute Engine, Cloud Storage, Cloud CDN, Cloud Armor, Cloud NAT, VPC, Load Balancing, Memorystore, IAM, Workload Identity, Secret Manager, KMS, Cloud Monitoring, Cloud Logging, Security Command Center, Organization Policies, Terraform on GCP, gcloud CLI)
- Microsoft Azure (AKS, App Service, Azure SQL, Blob Storage, Active Directory, Azure Functions)
- Docker (multi-stage builds, layer optimization, compose, Swarm, security scanning)
- Kubernetes (deployments, services, ingress, HPA, RBAC, Helm, operators, service mesh, network policies, CRDs, pod disruption budgets, Karpenter)
- PostgreSQL (query optimization, vacuum, replication, connection pooling, backups, pg_stat, partitioning, pgvector)
- Linux administration (systemd, networking, firewall, performance tuning, troubleshooting)
- CI/CD (GitHub Actions, GitLab CI, Jenkins, ArgoCD, Cloud Build, deployment strategies)
- Monitoring & Observability (Prometheus, Grafana, ELK, CloudWatch, Datadog, OpenTelemetry, distributed tracing, SLO/SLI, error budgets)
- Security hardening (CIS Benchmarks, SSH config, TLS, WAF, secrets management, RBAC, VPC Service Controls, Cloud Armor)
- Networking (DNS, load balancing, CDN, VPN, service mesh, TCP/UDP, HTTP/2, WebSocket, Cloud Interconnect)
- Infrastructure as Code (Terraform, Pulumi, Ansible, CloudFormation, Terraform modules, state management)
- Cost optimization (CUDs, sustained use discounts, spot instances, right-sizing, FinOps, budget alerts)

RULES:
- Be precise and actionable. Cite specific commands, config files, and best practices.
- Never hallucinate. If unsure, say so. Use [KB] tags for knowledge base citations.
- Prioritize reliability and security. Always consider failure modes.
- Match the user's technical level and response style preferences.
- When suggesting commands, always explain what they do and any risks.
- Prefer battle-tested approaches over cutting-edge experimental ones.`;

  sections.push(coreIdentity);
  tokenCount += estimateTokens(coreIdentity);

  // 2. Profile Summary (~200 tokens)
  const profile = getOrCreateProfile(userId);
  const profileSummary = getProfileSummary(profile);
  if (profileSummary !== 'No profile configured yet.') {
    const profileBlock = '\nUSER CONTEXT:\n' + profileSummary;
    if (tokenCount + estimateTokens(profileBlock) < maxTokenBudget) {
      sections.push(profileBlock);
      tokenCount += estimateTokens(profileBlock);
    }
  }

  // 3. Section Context (~150 tokens)
  if (currentSection) {
    const sectionCtx = getSectionContext(currentSection);
    if (sectionCtx) {
      const sectionBlock = '\nCURRENT SECTION: ' + sectionCtx.name + '\n' + sectionCtx.description + '\nAvailable capabilities: ' + sectionCtx.capabilities.join(', ') + '.';
      if (tokenCount + estimateTokens(sectionBlock) < maxTokenBudget) {
        sections.push(sectionBlock);
        tokenCount += estimateTokens(sectionBlock);
      }
    }
  }

  // 4. KB Hits (~500 tokens)
  const kbHits = [];
  if (userQuery) {
    const results = searchKB(userQuery, { maxResults: 5 });
    if (results.length) {
      const kbLines = results.slice(0, 5).map(r => {
        kbHits.push(r);
        return '[' + r.id + '] ' + r.title + ': ' + truncateToTokens(r.content, 100);
      });
      const kbBlock = '\nRELEVANT KNOWLEDGE:\n' + kbLines.join('\n');
      const kbTokens = estimateTokens(kbBlock);
      if (tokenCount + kbTokens < maxTokenBudget) {
        sections.push(kbBlock);
        tokenCount += kbTokens;
      } else {
        const available = maxTokenBudget - tokenCount - 50;
        if (available > 100) {
          sections.push(truncateToTokens(kbBlock, available));
          tokenCount += available;
        }
      }
    }
  }

  // 5. Recalled Memories (~300 tokens)
  const memoriesUsed = [];
  if (userQuery) {
    const memories = recallMemories(userId, userQuery, { maxResults: 3 });
    if (memories.length) {
      const memLines = memories.map(m => { memoriesUsed.push(m); return '- [' + m.type + '] ' + m.content; });
      const memBlock = '\nUSER MEMORY (from past interactions):\n' + memLines.join('\n');
      if (tokenCount + estimateTokens(memBlock) < maxTokenBudget) {
        sections.push(memBlock);
        tokenCount += estimateTokens(memBlock);
      }
    }
  }

  // 6. Action Catalog (~200 tokens)
  const suggestedActions = [];
  if (includeActions) {
    let actions = userQuery ? matchIntent(userQuery).slice(0, 3) : [];
    if (currentSection) {
      const sectionActions = getSuggestedActions(currentSection);
      for (const a of sectionActions) { if (!actions.find(e => e.id === a.id)) actions.push(a); }
    }
    actions = actions.slice(0, 5);
    if (actions.length) {
      const actionLines = actions.map(a => { suggestedActions.push(a); return '- ' + a.name + ' \u2192 navigate to "' + a.targetSection + '" section'; });
      const actionBlock = '\nAVAILABLE ACTIONS (suggest these when relevant):\n' + actionLines.join('\n');
      if (tokenCount + estimateTokens(actionBlock) < maxTokenBudget) {
        sections.push(actionBlock);
        tokenCount += estimateTokens(actionBlock);
      }
    }
  }

  // 7. Guardrails (~100 tokens)
  const guardrails = '\nGUIDELINES:\n- When citing KB entries, use format: [KB: ID]\n- Suggest navigation with format: **Go to: Section Name** when user needs a specific tool\n- If profile is incomplete, naturally ask about their infrastructure/stack/scale\n- For infrastructure suggestions, always mention specific Bulwark sections to use\n- Include command examples with explanations when relevant';
  if (tokenCount + estimateTokens(guardrails) < maxTokenBudget) {
    sections.push(guardrails);
  }

  const systemPrompt = sections.join('\n');
  const discoveryQuestion = profile.completion_score < 100 ? getNextDiscoveryQuestion(profile) : null;

  return {
    systemPrompt,
    kbHits,
    memoriesUsed,
    suggestedActions,
    discoveryQuestion: discoveryQuestion ? discoveryQuestion.question : null,
    tokenEstimate: estimateTokens(systemPrompt),
    profileCompletion: profile.completion_score,
  };
}

module.exports = { buildSystemPrompt };
