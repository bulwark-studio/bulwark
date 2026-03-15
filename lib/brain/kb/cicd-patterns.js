'use strict';

module.exports = [
  {
    id: 'CICD-001',
    title: 'GitHub Actions Workflow Basics',
    content: 'GitHub Actions workflows are defined in YAML files under .github/workflows/ and triggered by events like push, pull_request, or schedule. Each workflow contains jobs that run on specified runners (ubuntu-latest, windows-latest) and consist of sequential steps. Use the "actions/checkout" action to clone the repo and chain steps with "run" for shell commands or "uses" for reusable actions.',
    domain: 'cicd-patterns',
    tags: ['github-actions', 'workflows', 'yaml', 'ci'],
    bestPractice: 'Pin action versions to full SHA hashes instead of tags to prevent supply chain attacks.'
  },
  {
    id: 'CICD-002',
    title: 'GitHub Actions Matrix Builds',
    content: 'Matrix strategy runs a job across multiple configurations by defining variable combinations like OS versions, language versions, or feature flags. Define the matrix under "strategy.matrix" and reference variables with "${{ matrix.variable }}". Use "exclude" to skip specific combinations and "include" to add one-off configurations.',
    domain: 'cicd-patterns',
    tags: ['github-actions', 'matrix', 'testing', 'cross-platform'],
    fix: 'Add "fail-fast: false" to the strategy block so a failure in one matrix combination does not cancel the others.'
  },
  {
    id: 'CICD-003',
    title: 'GitHub Actions Reusable Workflows',
    content: 'Reusable workflows allow you to define a workflow once and call it from other workflows using "uses: org/repo/.github/workflows/shared.yml@main". They accept inputs and secrets parameters, enabling standardized CI/CD patterns across repositories. This reduces duplication and ensures consistent build, test, and deploy processes organization-wide.',
    domain: 'cicd-patterns',
    tags: ['github-actions', 'reusable', 'dry', 'organization'],
    bestPractice: 'Store reusable workflows in a dedicated .github repository and version them with tags for stability.'
  },
  {
    id: 'CICD-004',
    title: 'GitHub Actions Caching',
    content: 'The actions/cache action stores and restores dependency caches between workflow runs using content-addressable keys based on lock files. Cache node_modules with a key derived from package-lock.json hash, or pip packages from requirements.txt. Effective caching can reduce CI run times by 50-80% by avoiding redundant dependency downloads.',
    domain: 'cicd-patterns',
    tags: ['github-actions', 'caching', 'performance', 'dependencies'],
    fix: 'Use "actions/setup-node" with "cache: npm" for automatic caching, or manually configure actions/cache with a hash-based key.'
  },
  {
    id: 'CICD-005',
    title: 'GitHub Actions Secrets Management',
    content: 'GitHub Actions secrets are encrypted environment variables stored at the repository, environment, or organization level. Access them in workflows via "${{ secrets.SECRET_NAME }}" and they are automatically masked in logs. Use environment-level secrets with required reviewers for production deployments to enforce approval gates.',
    domain: 'cicd-patterns',
    tags: ['github-actions', 'secrets', 'security', 'environments'],
    bestPractice: 'Use OIDC federation with cloud providers instead of long-lived credentials stored as secrets.'
  },
  {
    id: 'CICD-006',
    title: 'GitLab CI Pipeline Configuration',
    content: 'GitLab CI pipelines are defined in .gitlab-ci.yml at the repository root and organized into stages that run sequentially (build, test, deploy). Jobs within the same stage run in parallel by default. Use "image" to specify Docker containers for job execution and "artifacts" to pass files between stages.',
    domain: 'cicd-patterns',
    tags: ['gitlab', 'ci', 'pipeline', 'yaml', 'stages'],
    bestPractice: 'Keep .gitlab-ci.yml lean by extracting shared logic into templates and using the include keyword.'
  },
  {
    id: 'CICD-007',
    title: 'GitLab CI Includes and Extends',
    content: 'The "include" keyword imports pipeline configuration from local files, remote URLs, other projects, or GitLab templates. The "extends" keyword lets jobs inherit from hidden template jobs prefixed with a dot. Combine both to build a library of reusable pipeline components that can be shared across projects and teams.',
    domain: 'cicd-patterns',
    tags: ['gitlab', 'ci', 'includes', 'templates', 'dry'],
    bestPractice: 'Use "include:project" to reference shared pipeline templates from a central repository for consistent CI across the org.'
  },
  {
    id: 'CICD-008',
    title: 'GitLab CI Rules and Conditional Jobs',
    content: 'The "rules" keyword replaces the older "only/except" syntax and provides fine-grained control over when jobs run based on variables, file changes, or pipeline source. Use "rules:changes" to run jobs only when specific files are modified and "rules:if" for branch or variable-based conditions. This enables efficient pipelines that skip unnecessary work.',
    domain: 'cicd-patterns',
    tags: ['gitlab', 'ci', 'rules', 'conditional', 'optimization'],
    fix: 'Replace deprecated "only/except" blocks with "rules" arrays for more predictable and powerful conditional logic.'
  },
  {
    id: 'CICD-009',
    title: 'Jenkins Declarative Pipeline',
    content: 'Jenkinsfile defines a declarative pipeline with a structured syntax containing agent, stages, steps, and post blocks. Declarative pipelines are easier to read and maintain than scripted pipelines and support features like parallel stages, input approval gates, and automatic retry. Store the Jenkinsfile in the repository root for pipeline-as-code versioning.',
    domain: 'cicd-patterns',
    tags: ['jenkins', 'pipeline', 'jenkinsfile', 'declarative'],
    bestPractice: 'Use shared libraries in Jenkins for reusable pipeline logic and keep Jenkinsfiles focused on orchestration, not business logic.'
  },
  {
    id: 'CICD-010',
    title: 'ArgoCD GitOps Deployment',
    content: 'ArgoCD is a declarative GitOps continuous delivery tool that syncs Kubernetes manifests from Git repositories to target clusters. It continuously monitors the desired state in Git and automatically or manually reconciles drift in the cluster. Application resources are defined as ArgoCD Application CRDs that specify the source repo, path, and destination cluster/namespace.',
    domain: 'cicd-patterns',
    tags: ['argocd', 'gitops', 'kubernetes', 'deployment', 'continuous-delivery'],
    bestPractice: 'Enable auto-sync with self-heal for non-production environments and require manual sync with approval for production.'
  },
  {
    id: 'CICD-011',
    title: 'Flux GitOps Patterns',
    content: 'Flux v2 implements GitOps by running controllers in the cluster that watch Git repositories, Helm repositories, and OCI registries for changes. It uses Kustomization and HelmRelease custom resources to define what to deploy and where. Flux supports multi-tenancy, dependency ordering, and health checks to ensure safe automated deployments.',
    domain: 'cicd-patterns',
    tags: ['flux', 'gitops', 'kubernetes', 'helm', 'kustomize'],
    bestPractice: 'Structure your Git repository with base and overlay directories using Kustomize for environment-specific configurations.'
  },
  {
    id: 'CICD-012',
    title: 'Rolling Deployment Strategy',
    content: 'Rolling deployments gradually replace old instances with new ones, maintaining availability by ensuring a minimum number of healthy instances at all times. In Kubernetes, this is the default strategy controlled by maxSurge and maxUnavailable parameters. It provides zero-downtime deploys but can temporarily run mixed versions during the rollout.',
    domain: 'cicd-patterns',
    tags: ['deployment', 'rolling', 'kubernetes', 'zero-downtime'],
    bestPractice: 'Set maxUnavailable to 0 and maxSurge to 25% for zero-downtime rolling updates with controlled resource usage.'
  },
  {
    id: 'CICD-013',
    title: 'Blue-Green Deployment Strategy',
    content: 'Blue-green deployment maintains two identical production environments where only one serves live traffic at a time. Deploy the new version to the idle environment, run smoke tests, then switch traffic via load balancer or DNS update. This enables instant rollback by switching back to the previous environment if issues are detected.',
    domain: 'cicd-patterns',
    tags: ['deployment', 'blue-green', 'rollback', 'zero-downtime'],
    bestPractice: 'Automate the traffic switch and validation checks, and keep the old environment running for at least one release cycle for quick rollback.'
  },
  {
    id: 'CICD-014',
    title: 'Canary Deployment Strategy',
    content: 'Canary deployments route a small percentage of traffic (1-10%) to the new version while the majority continues hitting the stable version. Monitor error rates, latency, and business metrics during the canary phase and progressively increase traffic if metrics are healthy. Tools like Flagger, Argo Rollouts, or Istio traffic splitting automate this pattern in Kubernetes.',
    domain: 'cicd-patterns',
    tags: ['deployment', 'canary', 'progressive', 'service-mesh', 'monitoring'],
    bestPractice: 'Define automated rollback thresholds based on error rate and latency percentiles to catch regressions before full rollout.'
  },
  {
    id: 'CICD-015',
    title: 'Feature Flags for Deployment Decoupling',
    content: 'Feature flags decouple code deployment from feature release by wrapping new functionality behind toggles that can be enabled or disabled at runtime. Use platforms like LaunchDarkly, Unleash, or Flagsmith to manage flags with user targeting, percentage rollouts, and A/B testing. This allows deploying code to production without exposing incomplete features to users.',
    domain: 'cicd-patterns',
    tags: ['feature-flags', 'toggles', 'deployment', 'release-management'],
    bestPractice: 'Clean up stale feature flags regularly to prevent technical debt; track flag age and ownership in your flag management tool.'
  },
  {
    id: 'CICD-016',
    title: 'CI Testing Stages: Lint and Static Analysis',
    content: 'Linting and static analysis should run as the first CI stage since they are fast and catch code style violations, syntax errors, and potential bugs without execution. Use ESLint, Pylint, or golangci-lint for language-specific linting and tools like SonarQube for deeper static analysis. Fail the pipeline early on lint errors to provide rapid feedback to developers.',
    domain: 'cicd-patterns',
    tags: ['testing', 'lint', 'static-analysis', 'quality', 'ci'],
    bestPractice: 'Configure lint rules as a shared package across repos and enforce them with pre-commit hooks and CI checks.'
  },
  {
    id: 'CICD-017',
    title: 'CI Testing Stages: Unit and Integration Tests',
    content: 'Unit tests validate individual functions in isolation and should run after linting as the second CI stage due to their speed. Integration tests verify interactions between components, databases, and external services, typically requiring Docker Compose or testcontainers for dependencies. Keep unit tests under 5 minutes and integration tests under 15 minutes for fast feedback.',
    domain: 'cicd-patterns',
    tags: ['testing', 'unit', 'integration', 'ci', 'test-pyramid'],
    bestPractice: 'Maintain a test pyramid with many fast unit tests, fewer integration tests, and minimal slow e2e tests.'
  },
  {
    id: 'CICD-018',
    title: 'CI Testing Stages: E2E, SAST, and DAST',
    content: 'End-to-end tests validate complete user workflows using tools like Cypress, Playwright, or Selenium and should run after unit/integration tests pass. SAST (Static Application Security Testing) scans source code for vulnerabilities, while DAST (Dynamic Application Security Testing) tests running applications for security flaws. Run SAST in CI on every PR and DAST against staging environments.',
    domain: 'cicd-patterns',
    tags: ['testing', 'e2e', 'sast', 'dast', 'security-testing'],
    bestPractice: 'Parallelize e2e test suites and use SAST tools like Semgrep or CodeQL that provide inline PR comments for fast remediation.'
  },
  {
    id: 'CICD-019',
    title: 'Docker Build Caching with BuildKit',
    content: 'BuildKit is the modern Docker build engine that supports advanced caching strategies including inline cache, registry cache, and local cache backends. Enable it with DOCKER_BUILDKIT=1 and use "--cache-from" and "--cache-to" flags to persist layer cache between CI runs. Multi-stage builds combined with BuildKit cache mounts for package managers can reduce build times by 60-90%.',
    domain: 'cicd-patterns',
    tags: ['docker', 'buildkit', 'caching', 'ci', 'performance'],
    fix: 'Use "--cache-from type=registry,ref=image:cache" and "--cache-to type=inline" to leverage registry-based layer caching in CI.'
  },
  {
    id: 'CICD-020',
    title: 'Docker Layer Caching in CI',
    content: 'Docker layer caching reuses previously built layers when the build context and Dockerfile instructions have not changed. Order Dockerfile instructions from least to most frequently changing: OS packages first, then dependency installation, then source code copy. This ensures expensive layers like package installation are cached across builds.',
    domain: 'cicd-patterns',
    tags: ['docker', 'caching', 'layers', 'dockerfile', 'optimization'],
    bestPractice: 'Copy dependency manifests (package.json, requirements.txt) before source code so dependency installation layers are cached independently.'
  },
  {
    id: 'CICD-021',
    title: 'Container Registry Management',
    content: 'Container registries (Docker Hub, ECR, GCR, GHCR) store and distribute Docker images used in CI/CD pipelines. Tag images with both the Git SHA for traceability and a semantic version for releases. Implement retention policies to automatically delete old images and scan stored images for vulnerabilities on a recurring schedule.',
    domain: 'cicd-patterns',
    tags: ['registry', 'docker', 'artifacts', 'ecr', 'ghcr'],
    bestPractice: 'Use immutable tags (Git SHA) for deployments and set up lifecycle policies to clean up untagged and old images.'
  },
  {
    id: 'CICD-022',
    title: 'Artifact Management for Packages',
    content: 'Package registries like npm, PyPI, Maven Central, and private registries (Artifactory, Nexus) store versioned build artifacts for consumption by downstream projects. Publish packages from CI after tests pass and use semantic versioning to communicate breaking changes. Private registries also serve as pull-through caches for public packages, improving reliability and security.',
    domain: 'cicd-patterns',
    tags: ['artifacts', 'npm', 'pypi', 'packages', 'registry'],
    bestPractice: 'Automate package publishing from CI using provenance attestations to verify artifact integrity and origin.'
  },
  {
    id: 'CICD-023',
    title: 'Environment Promotion Pipeline',
    content: 'Environment promotion moves artifacts through dev, staging, and production environments with increasing levels of validation and approval gates. Deploy the same immutable artifact (container image or package) across all environments, varying only configuration. Use environment-specific secrets and config maps, never rebuild artifacts between environments.',
    domain: 'cicd-patterns',
    tags: ['environments', 'promotion', 'dev', 'staging', 'production'],
    bestPractice: 'Build once, deploy everywhere: promote the exact same artifact through environments, changing only environment-specific configuration.'
  },
  {
    id: 'CICD-024',
    title: 'Rollback Strategies',
    content: 'Effective rollback strategies include redeploying the previous known-good artifact version, using Kubernetes "kubectl rollout undo", or switching traffic back in blue-green setups. Automate rollback triggers based on health checks, error rate thresholds, or failed smoke tests. Always test rollback procedures as part of deployment validation to ensure they work when needed.',
    domain: 'cicd-patterns',
    tags: ['rollback', 'deployment', 'recovery', 'reliability'],
    fix: 'Maintain a deployment history of at least 5 revisions and automate rollback with "kubectl rollout undo deployment/name --to-revision=N".'
  },
  {
    id: 'CICD-025',
    title: 'Semantic Versioning (SemVer)',
    content: 'Semantic versioning uses a MAJOR.MINOR.PATCH format where MAJOR indicates breaking changes, MINOR adds backward-compatible features, and PATCH covers bug fixes. Automate version bumps based on commit messages using tools like semantic-release or standard-version. Pre-release versions (1.0.0-beta.1) and build metadata (1.0.0+build.123) extend the base format.',
    domain: 'cicd-patterns',
    tags: ['versioning', 'semver', 'releases', 'semantic-release'],
    bestPractice: 'Use semantic-release with conventional commits to fully automate version bumping, changelog generation, and package publishing.'
  },
  {
    id: 'CICD-026',
    title: 'Conventional Commits',
    content: 'Conventional commits follow a structured format ("type(scope): description") that enables automated changelog generation and semantic version bumping. Common types include feat, fix, docs, chore, refactor, test, and perf. Breaking changes are indicated with a "!" suffix or BREAKING CHANGE footer. Enforce the format with commitlint and Husky pre-commit hooks.',
    domain: 'cicd-patterns',
    tags: ['commits', 'conventional', 'changelog', 'git', 'standards'],
    fix: 'Install commitlint and husky, add a commit-msg hook that runs "commitlint --edit $1" to enforce conventional commit format.'
  },
  {
    id: 'CICD-027',
    title: 'Trunk-Based Development',
    content: 'Trunk-based development has all developers committing to a single main branch (trunk) with short-lived feature branches that merge within 1-2 days. This minimizes merge conflicts, encourages continuous integration, and enables rapid release cycles. Use feature flags to hide incomplete work and keep the trunk always deployable.',
    domain: 'cicd-patterns',
    tags: ['branching', 'trunk-based', 'git', 'workflow', 'continuous-integration'],
    bestPractice: 'Keep feature branches under 24 hours and merge to trunk frequently; use feature flags instead of long-lived branches.'
  },
  {
    id: 'CICD-028',
    title: 'GitHub Flow Branching Strategy',
    content: 'GitHub Flow is a simplified branching model where developers create feature branches from main, open pull requests for review, and merge back to main after approval and CI checks pass. The main branch is always deployable and deployments are triggered by merging to main. This model works well for continuous deployment with a single production environment.',
    domain: 'cicd-patterns',
    tags: ['branching', 'github-flow', 'pull-requests', 'git', 'workflow'],
    bestPractice: 'Require PR reviews, passing CI checks, and up-to-date branches before merging to maintain a green main branch.'
  },
  {
    id: 'CICD-029',
    title: 'Monorepo CI with Nx',
    content: 'Nx provides intelligent build orchestration for monorepos by analyzing the project dependency graph and only running tasks for affected projects. The "nx affected" command compares changes against a base branch and identifies impacted projects and their dependents. Nx also provides remote caching via Nx Cloud to share build artifacts across CI runners and developer machines.',
    domain: 'cicd-patterns',
    tags: ['monorepo', 'nx', 'affected', 'caching', 'build-orchestration'],
    bestPractice: 'Configure Nx Cloud for distributed task execution to parallelize CI across multiple machines and share cached results.'
  },
  {
    id: 'CICD-030',
    title: 'Monorepo CI with Turborepo',
    content: 'Turborepo optimizes monorepo builds by running tasks in parallel based on the dependency graph defined in turbo.json. It provides local and remote caching, only re-executing tasks when inputs change based on content hashing. Configure pipeline dependencies to ensure correct build ordering (e.g., build depends on build of dependencies).',
    domain: 'cicd-patterns',
    tags: ['monorepo', 'turborepo', 'caching', 'parallel', 'build-orchestration'],
    fix: 'Define task pipelines in turbo.json with correct "dependsOn" fields and enable remote caching for CI with "turbo login && turbo link".'
  },
  {
    id: 'CICD-031',
    title: 'Affected Detection in Monorepos',
    content: 'Affected detection compares the current branch against the base branch to determine which packages, services, or applications have changed and need rebuilding or retesting. This prevents running the entire test suite for every change in a monorepo. Implement it using Git diff with dependency graph analysis, or use built-in support from Nx, Turborepo, or Lerna.',
    domain: 'cicd-patterns',
    tags: ['monorepo', 'affected', 'optimization', 'ci', 'git-diff'],
    bestPractice: 'Include transitive dependents in affected detection so that a library change triggers tests in all consuming applications.'
  },
  {
    id: 'CICD-032',
    title: 'CI Pipeline Security Best Practices',
    content: 'Secure CI pipelines by pinning dependency versions, using read-only tokens where possible, and scanning for secrets in code with tools like gitleaks or truffleHog. Isolate CI runners, limit secret access to required jobs, and audit pipeline configurations for injection vulnerabilities in user-controlled inputs. Enable OIDC for cloud provider authentication instead of storing long-lived credentials.',
    domain: 'cicd-patterns',
    tags: ['security', 'ci', 'secrets', 'supply-chain', 'oidc'],
    bestPractice: 'Use OIDC federation for cloud access, pin actions to SHA hashes, and run security scanning as a mandatory CI stage.'
  }
];
