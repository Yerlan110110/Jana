# PostgreSQL test-thread cleanup

18 October 2026. Finding `PG-TEST-CLEANUP` is repaired in the Academy concurrency-test fixture. Application connection settings and business commands are unchanged.

The full run at `.artifacts/interface-pilot-postgresql-20261018-1.log` passed 231 tests but warned that two remaining sessions prevented dropping the test database. The isolated four Academy concurrency tests did not reproduce this. Their passing result was not counted as a failing reproduction.

The complete strict run at `.artifacts/postgresql-thread-cleanup-full-strict-20261018-1.log` reproduced the defect. It passed 231 tests and ended with one teardown error because four sessions still held the test database. Treating `pytest.PytestWarning` as an error exposed the failed cleanup.

Academy's thread helper used `close_old_connections()` in its `finally` block. The [Django 5.2 connection documentation](https://docs.djangoproject.com/en/5.2/ref/databases/#persistent-connections) distinguishes thread-owned connections and old or unusable connection cleanup. With the project's 60-second connection age, a healthy worker connection could remain open after that thread completed. The other concurrency helpers already close their thread's connections explicitly.

The helper now calls `connections.close_all()` in its own thread's `finally` block. Pytest configuration promotes `pytest.PytestWarning` to an error, so failed database teardown can no longer be reported as an otherwise green run. It does not suppress Django's separate warnings.

The fresh full container run `.artifacts/postgresql-thread-cleanup-green-20261018-1.log` passes 231 tests, with 192 retained warnings and no teardown error. This is the same strict gate that previously failed. No production database was touched and no business record was deleted to obtain the result.
