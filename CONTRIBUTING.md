Steps to a new release
======================

1. Make a branch to fix a bug or add a feature, e.g. "json-diff-fix-68" or "json-diff-bignum-support".
1. Fix the bug or add the feature, add unit tests to detect that the bug fix or new feature works.
1. Make a PR from the branch against master and submit it.
1. Maintainer then does:
   - A review and squash-merge of the PR
   - git checkout master
   - git pull
   - rm -rf node_modules && bun install --frozen-lockfile
   - bun build ./src/index.ts --outdir ./dist --target node # add this step if the projects is ever converted to typescript
   - bun run test
   - update change log in README
   - git commit -a -m "chore: update README"; git push origin master
   - bun pm version <next.version.number>
   - git push --follow-tags origin master
   - npm stage list
   - npm stage view <stage-id>
   - npm stage approve <stage-id> or npm stage reject <stage-id>
