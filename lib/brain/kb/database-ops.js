'use strict';

module.exports = [
  // ─── PostgreSQL Configuration Tuning ───────────────────────────────
  {
    id: 'DBOPS-001',
    title: 'PostgreSQL shared_buffers tuning',
    content: 'Set shared_buffers to roughly 25% of total system RAM as a starting point. This parameter controls how much memory PostgreSQL dedicates to caching data pages in shared memory. On systems with more than 32 GB RAM, diminishing returns occur beyond 8-12 GB because the OS page cache also contributes. Monitor cache hit ratio via pg_stat_database; aim for 99%+ on OLTP workloads.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'memory', 'shared_buffers'],
    bestPractice: 'Start at 25% of RAM, benchmark with pgbench, and adjust based on pg_stat_bgwriter buffers_alloc vs buffers_backend metrics.'
  },
  {
    id: 'DBOPS-002',
    title: 'PostgreSQL work_mem tuning',
    content: 'work_mem controls how much memory each sort or hash operation can use before spilling to disk. The total memory consumed can be work_mem multiplied by the number of concurrent operations, so setting it too high on a system with many connections risks OOM. Check EXPLAIN ANALYZE output for "Sort Method: external merge Disk" to identify queries that need more work_mem.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'memory', 'work_mem'],
    bestPractice: 'Keep the global default conservative (4-64 MB) and use SET LOCAL work_mem for specific heavy queries within transactions.'
  },
  {
    id: 'DBOPS-003',
    title: 'PostgreSQL effective_cache_size',
    content: 'effective_cache_size is a planner hint, not an allocation, telling PostgreSQL how much memory is available for caching between shared_buffers and the OS page cache. Set it to approximately 50-75% of total system RAM. A higher value makes the planner more likely to choose index scans over sequential scans by estimating that index pages are likely cached.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'planner', 'effective_cache_size'],
    bestPractice: 'Set to the sum of shared_buffers plus the expected OS file system cache size, typically around 75% of total RAM on a dedicated database server.'
  },
  {
    id: 'DBOPS-004',
    title: 'PostgreSQL maintenance_work_mem tuning',
    content: 'maintenance_work_mem is used for VACUUM, CREATE INDEX, and ALTER TABLE ADD FOREIGN KEY operations. It can be set much higher than work_mem since only one maintenance operation typically runs per session. Setting it to 1-2 GB on systems with sufficient RAM drastically speeds up VACUUM and index creation on large tables.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'memory', 'maintenance_work_mem'],
    bestPractice: 'Set to 1 GB or higher on dedicated database servers. For autovacuum specifically, use autovacuum_work_mem to cap memory independently.'
  },
  {
    id: 'DBOPS-005',
    title: 'PostgreSQL wal_buffers configuration',
    content: 'wal_buffers sets the amount of shared memory used for WAL data that has not yet been written to disk. The default auto-tuning sets it to 1/32 of shared_buffers, capped at 16 MB, which is sufficient for most workloads. Increasing beyond 16 MB rarely provides benefit, but setting it below 1 MB can hurt write-heavy workloads.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'wal', 'wal_buffers'],
    bestPractice: 'Leave at -1 (auto) unless profiling shows WAL write contention, in which case 64 MB is a reasonable ceiling.'
  },
  {
    id: 'DBOPS-006',
    title: 'PostgreSQL max_connections and resource planning',
    content: 'Each PostgreSQL connection consumes approximately 5-10 MB of RAM for work_mem, temp_buffers, and session state. Setting max_connections to 500+ without a connection pooler leads to excessive context switching, lock contention, and memory pressure. A well-tuned production system should keep direct connections low and use PgBouncer or pgpool-II in front.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'connections', 'max_connections'],
    bestPractice: 'Keep max_connections at 100-200 and place a connection pooler in front. Reserve 3-5 connections for superuser access via superuser_reserved_connections.'
  },
  {
    id: 'DBOPS-007',
    title: 'PostgreSQL checkpoint_completion_target tuning',
    content: 'checkpoint_completion_target controls the fraction of the checkpoint interval over which dirty buffers are flushed. The default of 0.9 spreads I/O across 90% of the checkpoint interval, reducing I/O spikes. Setting it lower causes more aggressive bursts of writes. In PostgreSQL 14+, the default was changed from 0.5 to 0.9 to reflect this best practice.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'checkpoint', 'wal'],
    bestPractice: 'Keep at 0.9. Pair with max_wal_size set to 2-4 GB to reduce checkpoint frequency on write-heavy workloads.'
  },
  {
    id: 'DBOPS-008',
    title: 'PostgreSQL random_page_cost tuning',
    content: 'random_page_cost estimates the cost of a non-sequential disk page fetch relative to seq_page_cost. The default of 4.0 assumes spinning disks; for SSDs, set it to 1.1-1.5 to accurately reflect that random I/O is nearly as fast as sequential. Misconfiguring this value causes the planner to avoid index scans when they would actually be faster.',
    domain: 'database-ops',
    tags: ['postgresql', 'tuning', 'planner', 'random_page_cost', 'ssd'],
    bestPractice: 'Set to 1.1 for NVMe/SSD storage. If using a mix of SSD and HDD tablespaces, configure it per-tablespace using ALTER TABLESPACE SET.'
  },

  // ─── VACUUM and Autovacuum ─────────────────────────────────────────
  {
    id: 'DBOPS-009',
    title: 'VACUUM basics and dead tuple management',
    content: 'PostgreSQL MVCC creates dead tuples when rows are updated or deleted. VACUUM marks these dead tuples as reusable space but does not return disk space to the OS; only VACUUM FULL does that by rewriting the entire table with an ACCESS EXCLUSIVE lock. For large tables, regular VACUUM is essential to prevent table bloat and maintain query performance.',
    domain: 'database-ops',
    tags: ['postgresql', 'vacuum', 'dead-tuples', 'bloat'],
    fix: 'If a table has excessive bloat and VACUUM is not reclaiming enough, use pg_repack as a non-blocking alternative to VACUUM FULL.'
  },
  {
    id: 'DBOPS-010',
    title: 'Autovacuum tuning for high-write tables',
    content: 'Autovacuum triggers when dead tuples exceed autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * table_rows. The default scale_factor of 0.2 means 20% of the table must be dead before autovacuum kicks in, which is too late for large tables. For tables with millions of rows, set per-table overrides with ALTER TABLE SET (autovacuum_vacuum_scale_factor = 0.01).',
    domain: 'database-ops',
    tags: ['postgresql', 'autovacuum', 'tuning', 'dead-tuples'],
    bestPractice: 'For tables over 10M rows, use scale_factor of 0.01-0.05 and increase autovacuum_vacuum_cost_limit to 2000 to let autovacuum work faster.'
  },
  {
    id: 'DBOPS-011',
    title: 'Autovacuum cost-based throttling',
    content: 'Autovacuum uses cost-based delays to avoid overwhelming I/O. autovacuum_vacuum_cost_delay (default 2ms in PG12+) and autovacuum_vacuum_cost_limit (default 200, shared across all workers) control how aggressively autovacuum runs. If autovacuum consistently cannot keep up with dead tuple generation, increase cost_limit to 1000-2000 and consider adding more autovacuum_max_workers.',
    domain: 'database-ops',
    tags: ['postgresql', 'autovacuum', 'cost-delay', 'throttling'],
    bestPractice: 'Monitor n_dead_tup in pg_stat_user_tables. If dead tuples keep growing despite autovacuum running, raise cost_limit and lower cost_delay.'
  },
  {
    id: 'DBOPS-012',
    title: 'Preventing transaction ID wraparound',
    content: 'PostgreSQL uses 32-bit transaction IDs and must freeze old tuples before the counter wraps around at ~2 billion transactions. If autovacuum cannot freeze rows fast enough, PostgreSQL will shut down to prevent data corruption. Monitor age(datfrozenxid) in pg_database; values approaching 200 million trigger aggressive anti-wraparound autovacuum, which can cause severe I/O pressure.',
    domain: 'database-ops',
    tags: ['postgresql', 'vacuum', 'xid-wraparound', 'freeze'],
    fix: 'If datfrozenxid age exceeds 500M, run VACUUM FREEZE on the largest tables manually. Set autovacuum_freeze_max_age to trigger freezing before it becomes urgent.'
  },

  // ─── Connection Pooling ────────────────────────────────────────────
  {
    id: 'DBOPS-013',
    title: 'PgBouncer transaction mode pooling',
    content: 'In transaction mode, PgBouncer assigns a server connection to a client only for the duration of a transaction, then returns it to the pool. This allows hundreds of application connections to share a small pool of actual PostgreSQL connections. However, session-level features like prepared statements, LISTEN/NOTIFY, advisory locks, and SET commands do not work reliably in transaction mode.',
    domain: 'database-ops',
    tags: ['postgresql', 'pgbouncer', 'connection-pooling', 'transaction-mode'],
    bestPractice: 'Use transaction mode as the default. For applications that need prepared statements, enable server_prepared_statements in PgBouncer 1.21+ or use session mode for those specific pools.'
  },
  {
    id: 'DBOPS-014',
    title: 'PgBouncer session mode pooling',
    content: 'In session mode, PgBouncer assigns a server connection for the entire duration of the client session, behaving like a transparent proxy. This supports all PostgreSQL features but provides less connection multiplexing. Use session mode only when applications rely on session state, temporary tables, or prepared statements that cannot be adapted for transaction mode.',
    domain: 'database-ops',
    tags: ['postgresql', 'pgbouncer', 'connection-pooling', 'session-mode'],
    bestPractice: 'If you must use session mode, set server_idle_timeout aggressively (e.g., 300s) to reclaim idle connections and set max_client_conn high while keeping default_pool_size aligned with PostgreSQL max_connections.'
  },
  {
    id: 'DBOPS-015',
    title: 'Connection pool sizing formula',
    content: 'A good starting point for pool size is: pool_size = (core_count * 2) + effective_spindle_count. For SSD-backed databases, the spindle term is typically 1, giving roughly (cores * 2) + 1. Oversized pools cause lock contention, context switching, and cache thrashing inside PostgreSQL. Most OLTP workloads perform best with 20-50 active connections regardless of application thread count.',
    domain: 'database-ops',
    tags: ['postgresql', 'connection-pooling', 'sizing', 'performance'],
    bestPractice: 'Start with pool_size = (CPU cores * 2) + 1, benchmark under realistic load, and only increase if pg_stat_activity shows queries consistently waiting for connections.'
  },

  // ─── Replication ───────────────────────────────────────────────────
  {
    id: 'DBOPS-016',
    title: 'PostgreSQL streaming replication setup',
    content: 'Streaming replication continuously ships WAL records from a primary to standby servers over a TCP connection. The standby can operate in hot_standby mode, accepting read-only queries while applying WAL. Configure wal_level=replica, max_wal_senders >= number of standbys + 2, and create a replication slot to prevent the primary from discarding WAL segments the standby still needs.',
    domain: 'database-ops',
    tags: ['postgresql', 'replication', 'streaming', 'wal'],
    bestPractice: 'Always use replication slots to avoid WAL recycling issues. Monitor replication lag via pg_stat_replication (sent_lsn vs replay_lsn) and alert if lag exceeds a few seconds.'
  },
  {
    id: 'DBOPS-017',
    title: 'PostgreSQL logical replication',
    content: 'Logical replication decodes WAL into logical changes (INSERT/UPDATE/DELETE) and publishes them to subscribers. Unlike streaming replication, it allows replicating specific tables, cross-version replication, and writing to the subscriber. Set wal_level=logical and create publications/subscriptions. Each table requires a REPLICA IDENTITY (typically the primary key) for UPDATE and DELETE operations to work.',
    domain: 'database-ops',
    tags: ['postgresql', 'replication', 'logical', 'publication', 'subscription'],
    bestPractice: 'Use logical replication for zero-downtime major version upgrades: set up the new version as a subscriber, sync, then switch traffic. Monitor pg_stat_subscription for replication lag.'
  },
  {
    id: 'DBOPS-018',
    title: 'Read replicas and load balancing',
    content: 'Read replicas handle read-only queries to offload the primary. Applications must be aware that replicas may lag behind, so eventual consistency is acceptable for analytics and reporting but not for reads-after-writes patterns. Use connection routing at the application level or with tools like HAProxy and Patroni to direct writes to primary and reads to replicas.',
    domain: 'database-ops',
    tags: ['postgresql', 'replication', 'read-replica', 'load-balancing'],
    bestPractice: 'Set hot_standby_feedback=on to prevent vacuum from removing rows still needed by replica queries, avoiding "canceling statement due to conflict with recovery" errors.'
  },

  // ─── Backup and Recovery ───────────────────────────────────────────
  {
    id: 'DBOPS-019',
    title: 'pg_dump for logical backups',
    content: 'pg_dump creates a consistent snapshot of a database using a serializable transaction. Use pg_dump -Fc for custom format (compressed, supports parallel restore) or -Fd for directory format with parallel dump. For full cluster backups including roles and tablespaces, use pg_dumpall. Logical backups are portable across architectures but slow for databases over ~100 GB.',
    domain: 'database-ops',
    tags: ['postgresql', 'backup', 'pg_dump', 'logical-backup'],
    bestPractice: 'Use pg_dump -Fd -j 4 for parallel dump of large databases. Always test restores regularly — an untested backup is not a backup.'
  },
  {
    id: 'DBOPS-020',
    title: 'pg_basebackup for physical backups',
    content: 'pg_basebackup takes a binary copy of the entire PostgreSQL data directory over a replication connection. It is the foundation for setting up streaming replicas and point-in-time recovery. Use -X stream to include WAL files needed for consistency, and -z for compression. Physical backups are faster than pg_dump for large databases but are not portable across major versions.',
    domain: 'database-ops',
    tags: ['postgresql', 'backup', 'pg_basebackup', 'physical-backup'],
    bestPractice: 'Schedule pg_basebackup during low-traffic periods. Combine with WAL archiving for continuous PITR capability. Use --checkpoint=fast to reduce backup startup time.'
  },
  {
    id: 'DBOPS-021',
    title: 'WAL archiving and point-in-time recovery (PITR)',
    content: 'WAL archiving copies completed WAL segments to a separate storage location using archive_command. Combined with a base backup, it enables point-in-time recovery to any moment between the base backup and the latest archived WAL. Configure archive_mode=on and set archive_command to copy WAL files to S3, GCS, or a network share. Tools like pgBackRest and WAL-G automate this process.',
    domain: 'database-ops',
    tags: ['postgresql', 'backup', 'wal-archiving', 'pitr', 'recovery'],
    bestPractice: 'Use pgBackRest or WAL-G instead of raw archive_command for compression, encryption, parallel transfer, and backup catalog management. Test PITR recovery quarterly.'
  },

  // ─── Query Optimization ────────────────────────────────────────────
  {
    id: 'DBOPS-022',
    title: 'Using EXPLAIN ANALYZE effectively',
    content: 'EXPLAIN ANALYZE actually executes the query and shows real row counts, execution times, and buffer usage alongside the planner estimates. Add BUFFERS to see shared/local hit and read counts, which reveal I/O patterns. Compare estimated rows to actual rows — large discrepancies indicate stale statistics or data distribution issues that need an ANALYZE or custom statistics target.',
    domain: 'database-ops',
    tags: ['postgresql', 'query-optimization', 'explain-analyze', 'performance'],
    bestPractice: 'Use EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML) for detailed output. Never run EXPLAIN ANALYZE on mutating queries in production without wrapping in a transaction and rolling back.'
  },
  {
    id: 'DBOPS-023',
    title: 'B-tree indexes and selectivity',
    content: 'B-tree indexes are the default and most versatile index type in PostgreSQL, optimal for equality and range queries. They are most effective on high-selectivity columns where queries return a small fraction of rows. An index on a boolean column with 50/50 distribution wastes space because the planner will choose a sequential scan anyway. Multi-column B-tree indexes follow the leftmost prefix rule.',
    domain: 'database-ops',
    tags: ['postgresql', 'indexes', 'b-tree', 'selectivity'],
    bestPractice: 'Order columns in a multi-column index by equality predicates first, then range predicates. Monitor unused indexes via pg_stat_user_indexes (idx_scan = 0) and drop them to reduce write overhead.'
  },
  {
    id: 'DBOPS-024',
    title: 'GIN indexes for full-text and JSONB',
    content: 'GIN (Generalized Inverted Index) indexes map each element or key to the rows containing it, making them ideal for full-text search (tsvector), JSONB containment (@>), and array operations. GIN indexes are slower to build and update than B-tree but excel at multi-value lookups. Use the jsonb_path_ops operator class for JSONB @> queries to reduce index size by 2-3x.',
    domain: 'database-ops',
    tags: ['postgresql', 'indexes', 'gin', 'jsonb', 'full-text-search'],
    bestPractice: 'Set maintenance_work_mem high before building GIN indexes on large tables. Use fastupdate=off on write-heavy tables to avoid GIN pending list bloat.'
  },
  {
    id: 'DBOPS-025',
    title: 'Partial indexes for filtered queries',
    content: 'Partial indexes include only rows matching a WHERE clause, dramatically reducing index size and maintenance cost. They are perfect for queries that always filter on a specific condition, such as WHERE status = \'active\' or WHERE deleted_at IS NULL. A partial index on a 100M-row table where only 1% of rows match the predicate is 99% smaller than a full index.',
    domain: 'database-ops',
    tags: ['postgresql', 'indexes', 'partial-index', 'optimization'],
    bestPractice: 'Ensure your query WHERE clause matches or implies the partial index predicate exactly. PostgreSQL will not use the index if the query predicate does not match.'
  },
  {
    id: 'DBOPS-026',
    title: 'Covering indexes with INCLUDE columns',
    content: 'Covering indexes (PostgreSQL 11+) add non-key columns via the INCLUDE clause, enabling index-only scans without adding those columns to the B-tree structure. This avoids heap fetches when all queried columns are in the index. The INCLUDE columns are stored only in leaf pages and cannot be used for filtering or sorting, but they eliminate the need for a heap lookup.',
    domain: 'database-ops',
    tags: ['postgresql', 'indexes', 'covering-index', 'include', 'index-only-scan'],
    bestPractice: 'Use INCLUDE for columns in SELECT but not in WHERE/ORDER BY. Monitor pg_stat_user_indexes for index-only scan ratios and ensure VACUUM runs regularly to maintain the visibility map.'
  },

  // ─── Common PostgreSQL Errors ──────────────────────────────────────
  {
    id: 'DBOPS-027',
    title: 'Error: too many connections for role',
    content: 'This error occurs when active connections exceed max_connections or a per-role connection limit set via ALTER ROLE SET CONNECTION LIMIT. Each idle connection in PostgreSQL consumes memory and a process slot. The immediate fix is to terminate idle connections with pg_terminate_backend(), but the long-term solution is deploying a connection pooler like PgBouncer.',
    domain: 'database-ops',
    tags: ['postgresql', 'error', 'connections', 'troubleshooting'],
    fix: 'Deploy PgBouncer in transaction mode. Query pg_stat_activity to identify and terminate idle connections: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle\' AND query_start < now() - interval \'10 minutes\'.'
  },
  {
    id: 'DBOPS-028',
    title: 'Error: lock timeout / deadlock detected',
    content: 'Lock timeouts occur when a session waits longer than lock_timeout to acquire a lock. Deadlocks happen when two or more transactions hold locks that the others need. PostgreSQL automatically detects deadlocks and aborts one transaction. Frequent deadlocks indicate that transactions acquire locks in inconsistent order or hold locks for too long due to long-running transactions.',
    domain: 'database-ops',
    tags: ['postgresql', 'error', 'locks', 'deadlock', 'troubleshooting'],
    fix: 'Set lock_timeout to a reasonable value (e.g., 5s) to fail fast. Ensure all code paths acquire locks in a consistent order. Use pg_locks joined with pg_stat_activity to diagnose blocking chains.'
  },
  {
    id: 'DBOPS-029',
    title: 'Error: out of shared memory',
    content: 'This error typically occurs when max_locks_per_transaction is exhausted, often during operations that touch many tables such as partition pruning with thousands of partitions or large schema migrations. Each lock slot consumes shared memory, and the total is max_locks_per_transaction * max_connections. Increasing max_locks_per_transaction requires a server restart.',
    domain: 'database-ops',
    tags: ['postgresql', 'error', 'shared-memory', 'locks', 'troubleshooting'],
    fix: 'Increase max_locks_per_transaction (default 64) to 128 or 256 and restart. For partition-heavy schemas, consider consolidating partitions or batching DDL operations.'
  },
  {
    id: 'DBOPS-030',
    title: 'Error: could not resize shared memory segment',
    content: 'On Linux, this error is often caused by insufficient POSIX shared memory limits or Docker container defaults. PostgreSQL uses mmap for dynamic shared memory on modern systems (dynamic_shared_memory_type = posix). In Docker, this is resolved by setting --shm-size or mounting /dev/shm with adequate space. The default Docker shm size of 64MB is almost always too small for production PostgreSQL.',
    domain: 'database-ops',
    tags: ['postgresql', 'error', 'shared-memory', 'docker', 'troubleshooting'],
    fix: 'In Docker, use --shm-size=256m or mount a larger tmpfs at /dev/shm. On bare metal, verify /proc/sys/kernel/shmmax and /proc/sys/kernel/shmall are sufficient.'
  },

  // ─── PostgreSQL Extensions ─────────────────────────────────────────
  {
    id: 'DBOPS-031',
    title: 'pg_stat_statements for query performance tracking',
    content: 'pg_stat_statements tracks execution statistics for all SQL statements: call count, total/mean time, rows returned, and buffer usage. It normalizes queries by replacing constants with placeholders, grouping similar queries together. Add it to shared_preload_libraries and restart PostgreSQL. Query pg_stat_statements ordered by total_exec_time to find the most impactful queries to optimize.',
    domain: 'database-ops',
    tags: ['postgresql', 'extension', 'pg_stat_statements', 'monitoring'],
    bestPractice: 'Set pg_stat_statements.track = all to include nested queries. Periodically call pg_stat_statements_reset() to avoid stale data, or snapshot the stats to a history table before resetting.'
  },
  {
    id: 'DBOPS-032',
    title: 'pgvector for AI embedding search',
    content: 'pgvector adds vector similarity search to PostgreSQL, supporting L2 distance, inner product, and cosine distance operators. Store embeddings as vector(1536) columns and create IVFFlat or HNSW indexes for approximate nearest neighbor search. HNSW indexes provide better recall at the cost of more memory and slower builds, while IVFFlat is faster to build but requires a representative training set.',
    domain: 'database-ops',
    tags: ['postgresql', 'extension', 'pgvector', 'embeddings', 'ai'],
    bestPractice: 'Use HNSW indexes (CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)) for best recall. Set ef_search to 100-200 at query time for a good speed/accuracy tradeoff.'
  },
  {
    id: 'DBOPS-033',
    title: 'PostGIS for geospatial data',
    content: 'PostGIS adds spatial types (geometry, geography), spatial indexing (GiST-based R-tree), and thousands of spatial functions to PostgreSQL. Use the geography type for lat/lon data to get correct distance calculations on the spheroid. Spatial queries benefit enormously from GiST indexes; without them, every ST_DWithin or ST_Contains query triggers a full table scan.',
    domain: 'database-ops',
    tags: ['postgresql', 'extension', 'postgis', 'geospatial', 'gis'],
    bestPractice: 'Always create a GiST index on geometry columns. Use ST_DWithin instead of ST_Distance < X for indexed distance queries. Store data in SRID 4326 for geographic coordinates.'
  },
  {
    id: 'DBOPS-034',
    title: 'pg_cron for in-database job scheduling',
    content: 'pg_cron enables cron-like job scheduling directly inside PostgreSQL, running SQL statements or stored procedures on a schedule. It uses the standard cron syntax and stores job definitions in the cron schema. Jobs run as background workers and are ideal for partition maintenance, statistics aggregation, old data cleanup, and materialized view refreshes.',
    domain: 'database-ops',
    tags: ['postgresql', 'extension', 'pg_cron', 'scheduling', 'automation'],
    bestPractice: 'Use pg_cron for REFRESH MATERIALIZED VIEW CONCURRENTLY on a schedule. Monitor job results in cron.job_run_details and set up alerts on failures. Keep job runtime short to avoid blocking.'
  },

  // ─── Redis Operations ──────────────────────────────────────────────
  {
    id: 'DBOPS-035',
    title: 'Redis persistence: RDB vs AOF',
    content: 'RDB persistence creates point-in-time snapshots at configurable intervals using fork(), which is fast for recovery but can lose data since the last snapshot. AOF logs every write operation and can be configured with fsync policies (always, everysec, no). Use both together for the best durability: AOF for minimal data loss and RDB for faster restarts and backups.',
    domain: 'database-ops',
    tags: ['redis', 'persistence', 'rdb', 'aof'],
    bestPractice: 'Use appendfsync everysec as a balanced AOF setting. Enable RDB snapshots as a fallback. Monitor the AOF rewrite process (BGREWRITEAOF) to prevent unbounded file growth.'
  },
  {
    id: 'DBOPS-036',
    title: 'Redis eviction policies',
    content: 'When Redis reaches maxmemory, the eviction policy determines which keys to remove. allkeys-lru evicts the least recently used key from all keys, suitable for cache-only workloads. volatile-lru only evicts keys with a TTL set. noeviction returns errors on writes when memory is full, appropriate when Redis is used as a primary data store. allkeys-lfu (LFU) is often better than LRU for skewed access patterns.',
    domain: 'database-ops',
    tags: ['redis', 'eviction', 'memory', 'maxmemory'],
    bestPractice: 'Use allkeys-lfu for cache workloads with hot/cold keys. Set maxmemory to 75% of available RAM to leave room for fragmentation and fork overhead during RDB saves.'
  },
  {
    id: 'DBOPS-037',
    title: 'Redis Cluster architecture',
    content: 'Redis Cluster partitions data across multiple nodes using 16384 hash slots. Each master node owns a subset of slots and can have one or more replicas for failover. The cluster uses a gossip protocol for node discovery and automatic failover. Multi-key commands only work when all keys map to the same hash slot, enforced using hash tags like {user:1000}.profile and {user:1000}.settings.',
    domain: 'database-ops',
    tags: ['redis', 'cluster', 'sharding', 'hash-slots'],
    bestPractice: 'Use at least 3 masters and 3 replicas for production. Design key schemas with hash tags for related data. Use CLUSTER KEYSLOT to verify key placement during development.'
  },
  {
    id: 'DBOPS-038',
    title: 'Redis Pub/Sub and Streams',
    content: 'Redis Pub/Sub provides fire-and-forget messaging where subscribers receive messages only while connected — there is no persistence or backlog. For durable messaging with consumer groups, acknowledgments, and message replay, use Redis Streams (XADD/XREAD/XREADGROUP). Streams support consumer groups similar to Kafka, making them suitable for reliable event processing with at-least-once delivery.',
    domain: 'database-ops',
    tags: ['redis', 'pubsub', 'streams', 'messaging'],
    bestPractice: 'Use Streams over Pub/Sub when message loss is unacceptable. Set MAXLEN on streams to cap memory usage. Use XACK to acknowledge processed messages and XPENDING to monitor unprocessed entries.'
  },
  {
    id: 'DBOPS-039',
    title: 'Redis memory optimization techniques',
    content: 'Redis stores small aggregates (hashes, lists, sets) using memory-efficient ziplist/listpack encodings when element count and size stay below configured thresholds (hash-max-ziplist-entries, etc.). Keep hashes under 128 fields and values under 64 bytes to benefit from this optimization. For large datasets, use MEMORY USAGE <key> to identify memory-heavy keys and OBJECT ENCODING to verify encoding types.',
    domain: 'database-ops',
    tags: ['redis', 'memory', 'optimization', 'encoding'],
    bestPractice: 'Tune ziplist thresholds based on your data profile. Use SCAN instead of KEYS for iterating large keyspaces. Monitor memory fragmentation ratio and restart if it exceeds 1.5.'
  },

  // ─── MongoDB ───────────────────────────────────────────────────────
  {
    id: 'DBOPS-040',
    title: 'MongoDB replica set architecture',
    content: 'A MongoDB replica set consists of a primary node and one or more secondary nodes that maintain copies of the data via oplog replication. Elections occur automatically when the primary becomes unavailable, requiring a majority of voting members to elect a new primary. Deploy an odd number of members (typically 3 or 5) to avoid split-brain scenarios. Use an arbiter only when cost constraints prevent a full data-bearing member.',
    domain: 'database-ops',
    tags: ['mongodb', 'replica-set', 'replication', 'high-availability'],
    bestPractice: 'Prefer 3 data-bearing members over 2 + arbiter. Set appropriate write concern (w: "majority") for durability. Monitor replication lag via rs.printSecondaryReplicationInfo().'
  },
  {
    id: 'DBOPS-041',
    title: 'MongoDB sharding strategy',
    content: 'MongoDB sharding distributes data across shards using a shard key. Choose a shard key with high cardinality, even distribution, and query isolation (queries include the shard key). Range-based sharding supports range queries but can create hotspots; hashed sharding provides even distribution but sacrifices range query efficiency. The shard key is immutable once set, so choose carefully.',
    domain: 'database-ops',
    tags: ['mongodb', 'sharding', 'shard-key', 'horizontal-scaling'],
    bestPractice: 'Use a compound shard key combining a coarse locality field with a high-cardinality field. Avoid monotonically increasing shard keys (like ObjectId) with range sharding as they create write hotspots on a single shard.'
  },
  {
    id: 'DBOPS-042',
    title: 'MongoDB indexing strategies',
    content: 'MongoDB uses B-tree indexes similar to relational databases. Compound indexes follow the ESR rule: Equality fields first, then Sort fields, then Range fields. Use explain("executionStats") to verify index usage and examine totalDocsExamined vs totalKeysExamined. Covered queries, where all returned fields are in the index, avoid document fetches entirely and are significantly faster.',
    domain: 'database-ops',
    tags: ['mongodb', 'indexing', 'compound-index', 'query-optimization'],
    bestPractice: 'Follow the ESR rule for compound indexes. Use db.collection.getIndexes() and $indexStats to identify unused indexes. Create indexes in the background on production systems using createIndex with the background option or rolling index builds on replica sets.'
  },
  {
    id: 'DBOPS-043',
    title: 'MongoDB WiredTiger storage engine tuning',
    content: 'WiredTiger is the default storage engine, using document-level locking and compression (snappy by default, zlib/zstd available). The WiredTiger cache defaults to 50% of RAM minus 1 GB. Monitor cache utilization via serverStatus().wiredTiger.cache; if "bytes read into cache" is consistently high while "bytes currently in cache" is at the limit, the working set exceeds cache size and you may need more RAM or to optimize queries.',
    domain: 'database-ops',
    tags: ['mongodb', 'wiredtiger', 'storage-engine', 'tuning'],
    bestPractice: 'Use zstd compression for 30-40% better compression than snappy with minimal CPU overhead. Keep the working set within the WiredTiger cache size to avoid disk reads.'
  },
  {
    id: 'DBOPS-044',
    title: 'MongoDB read preference and write concern',
    content: 'Read preference controls which replica set members serve read queries: primary (default, strongest consistency), primaryPreferred, secondary (for offloading reads), secondaryPreferred, or nearest (lowest latency). Write concern w:"majority" ensures writes are acknowledged by a majority of members, preventing rollback on failover. Use j:true to require journal commit for maximum durability.',
    domain: 'database-ops',
    tags: ['mongodb', 'read-preference', 'write-concern', 'consistency'],
    bestPractice: 'Use w:"majority" with j:true for critical writes. Use secondary read preference only for analytics queries where stale reads are acceptable. Set maxStalenessSeconds when using secondary reads.'
  },
  {
    id: 'DBOPS-045',
    title: 'PostgreSQL table partitioning strategies',
    content: 'Declarative partitioning (PG 10+) splits large tables into smaller physical tables by range, list, or hash. Range partitioning on timestamp columns is the most common pattern for time-series data, enabling efficient partition pruning and cheap data archival by dropping old partitions. Hash partitioning distributes data evenly across a fixed number of partitions for workloads without a natural range key.',
    domain: 'database-ops',
    tags: ['postgresql', 'partitioning', 'performance', 'table-design'],
    bestPractice: 'Create partitions ahead of time using pg_partman or pg_cron. Keep partition count under 1000 to avoid planner overhead. Ensure queries include the partition key in WHERE clauses for partition pruning.'
  }
];
