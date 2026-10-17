# Bind replacement readiness to the selected Compose project

18 October 2026. A local packaging run exposed an error in the verification boundary. The replacement script selected `janamen-ci` containers but defaulted readiness to API port 8000 and web port 8080. Those ports belonged to `janamen-demo`. The actual selected application used 8010 and 8090.

The behavioral RED is `.artifacts/packaging-docker-regression-20261018.log`. The first employee setup receives an actual 502 from `/api/v1/auth/me/` and displays the recoverable server-error page. The earlier script had already reported success against the other running stack. Manager and HR later pass on the same frontend, which rules out a broken login label or bundle as the explanation. No automatic browser retry or arbitrary startup delay is added.

`scripts/verification/nginx_replacement.py` now obtains the two published origins with `docker compose -p <project> port`. It requires one loopback binding per service. Optional origin arguments assert that same address rather than selecting another stack. The report records both actual origins with container identity and addresses.

The real negative control at `.artifacts/nginx-origin-negative-20261018.log` supplies web port 8080 for `janamen-ci`. It exits 2 and identifies the expected origin `http://127.0.0.1:8090`. API and frontend container IDs remain unchanged, recorded at `.artifacts/nginx-origin-negative-20261018.json`. The rejected invocation creates no recovery report and performs no replacement.

The real GREEN is `.artifacts/nginx-project-origin-green-20261018.json`. Readiness uses API 8010 and web 8090. API address changes from `172.29.1.3` to `172.29.1.5`. The frontend container and start time remain unchanged. The subsequent sixteen-test Docker run passes at `.artifacts/packaging-docker-regression-20261018-2.log`, including the first employee sign-in.

Earlier local reports without recorded origins are insufficient evidence of project-bound readiness. Their address and frontend-identity observations remain, but their local readiness claims are withdrawn pending this corrected check. The GitHub workflow uses ports 8000 and 8080 for its own `janamen-ci` stack, so its matching-origin runs remain applicable. Keep the original local failure and reports rather than rewriting them.

Fix Root Causes changed the script's target selection. Model the Domain derives readiness from the same selected Compose project that owns the mutation. Prove It Works adds a wrong-origin rejection and an actual post-replacement browser run. The material risk is checking one stack while replacing another. Both negative and positive controls target that exact mismatch. This is DNS recovery evidence, not a zero-downtime deployment guarantee.
