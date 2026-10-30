# The deploy-web workflow. .github/workflows/deploy-web.yml is emitted from
# this and is never edited by hand:
#   nix eval --json --file ci/deploy-web.nix | jq . > .github/workflows/deploy-web.yml
let
  # The build lives next to the code it builds. A deployment supplies where it
  # goes; everything about how the bundle is produced is here, once.
  q = "'"; # a literal single quote, where '' followed by ${ cannot be written
in
{
  name = "deploy-web";

  on.workflow_call.inputs = {
    branch = {
      description = "QNTX-Web branch to build and deploy";
      type = "string";
      required = true;
    };
    static_bucket = {
      description = "S3 bucket serving the SPA";
      type = "string";
      required = true;
    };
    backend_url = {
      description = "API origin baked into the bundle";
      type = "string";
      required = true;
    };
    sentry_dsn = {
      description = "Where the frontend logger leaves to; empty is off";
      type = "string";
      required = false;
      default = "";
    };
    deploy_role_arn = {
      description = "IAM role assumed via OIDC";
      type = "string";
      required = true;
    };
    cloudfront_alias = {
      description = "Distribution alias to resolve and invalidate";
      type = "string";
      required = true;
    };
    kvs_name = {
      description = "CloudFront key-value store holding known branch prefixes";
      type = "string";
      required = true;
    };
    aws_region = {
      type = "string";
      default = "eu-central-1";
    };
    bun_version = {
      type = "string";
      default = "1.3.9";
    };
    # A deployment that has its own runner names it here, as JSON: a label
    # string, or a list of labels a runner must carry all of.
    runs_on = {
      description = "Runner labels as JSON, e.g. [\"self-hosted\",\"q-box\"]";
      type = "string";
      required = false;
      default = "\"ubuntu-latest\"";
    };
  };

  jobs.build-and-deploy = {
    runs-on = "\${{ fromJSON(inputs.runs_on) }}";
    timeout-minutes = 20;
    permissions = {
      id-token = "write";
      contents = "read";
    };

    steps = [
      {
        name = "Checkout QNTX-Web";
        uses = "actions/checkout@v4";
        "with" = {
          repository = "teranos/QNTX-Web";
          ref = "\${{ inputs.branch }}";
          # The web's version is git describe of its tags (build.ts): a checkout without them stamps dev.
          fetch-depth = 0;
          fetch-tags = true;
        };
      }

      {
        name = "Compute target";
        id = "target";
        run = ''
          BRANCH="''${{ inputs.branch }}"
          if [ "$BRANCH" = "main" ]; then
            PREFIX=""
            INVAL="/*"
          else
            PREFIX="branch/''${BRANCH}/"
            INVAL="/branch/''${BRANCH}/*"
          fi
          echo "prefix=$PREFIX"      >> "$GITHUB_OUTPUT"
          echo "invalidation=$INVAL" >> "$GITHUB_OUTPUT"
          echo "url=https://''${{ inputs.static_bucket }}/''${PREFIX}" >> "$GITHUB_OUTPUT"
        '';
      }

      {
        name = "Setup Bun";
        uses = "oven-sh/setup-bun@v2";
        "with".bun-version = "\${{ inputs.bun_version }}";
      }

      # The browser WASM is a dependency: QNTX's release builds it from its
      # crates and package.json names the release. No Rust runs here.
      {
        name = "Build web bundle";
        env = {
          BACKEND_URL = "\${{ inputs.backend_url }}";
          SENTRY_DSN = "\${{ inputs.sentry_dsn }}";
        };
        run = ''
          bun install --frozen-lockfile
          bun run build
        '';
      }

      {
        name = "Prefix asset paths for branch bundles";
        "if" = "inputs.branch != 'main'";
        run = ''
          BRANCH="''${{ inputs.branch }}"
          sed -i "s|src=\"/|src=\"/branch/''${BRANCH}/|g; s|href=\"/|href=\"/branch/''${BRANCH}/|g" \
            dist/index.html
        '';
      }

      {
        name = "Verify bundle contents";
        run = ''
          test -f dist/index.html || { echo "index.html missing"; exit 1; }
          test -f dist/js/main.js || { echo "js/main.js missing"; exit 1; }
          for W in dist/js/*.wasm; do
            test -s "$W" || { echo "empty wasm: $W"; exit 1; }
          done
          ls -la dist/js/
        '';
      }

      {
        name = "Assume deploy role";
        uses = "aws-actions/configure-aws-credentials@v4";
        "with" = {
          role-to-assume = "\${{ inputs.deploy_role_arn }}";
          aws-region = "\${{ inputs.aws_region }}";
        };
      }

      {
        name = "Sync bundle to S3";
        run = ''
          PREFIX="''${{ steps.target.outputs.prefix }}"
          EXTRA=()
          if [ -z "$PREFIX" ]; then
            EXTRA+=(--exclude "branch/*")
          fi
          aws s3 sync dist/ "s3://''${{ inputs.static_bucket }}/''${PREFIX}" \
            --delete \
            --cache-control "public, max-age=300" \
            --exclude "index.html" \
            "''${EXTRA[@]}"
          aws s3 cp dist/index.html "s3://''${{ inputs.static_bucket }}/''${PREFIX}index.html" \
            --cache-control "public, max-age=60, must-revalidate" \
            --content-type "text/html; charset=utf-8"
        '';
      }

      {
        name = "Regenerate versions.json";
        run = ''
          aws s3api list-objects-v2 --bucket "''${{ inputs.static_bucket }}" \
            --prefix "branch/" \
            --delimiter '/' \
            --query 'CommonPrefixes[].Prefix' \
            --output json | jq '(. // []) | map(sub("^branch/"; "") | rtrimstr("/"))' > versions.json
          aws s3 cp versions.json "s3://''${{ inputs.static_bucket }}/versions.json" \
            --cache-control "public, max-age=60, must-revalidate" \
            --content-type "application/json"
        '';
      }

      {
        name = "Register branch in KVS";
        "if" = "inputs.branch != 'main'";
        run = ''
          KVS_ARN=$(aws cloudfront list-key-value-stores \
            --query "KeyValueStoreList.Items[?Name==${q}''${{ inputs.kvs_name }}'] | [0].ARN" \
            --output text)
          test -n "$KVS_ARN" && test "$KVS_ARN" != "None" || { echo "no KVS named ''${{ inputs.kvs_name }}"; exit 1; }
          ETAG=$(aws cloudfront-keyvaluestore describe-key-value-store \
            --kvs-arn "$KVS_ARN" \
            --query ETag --output text)
          aws cloudfront-keyvaluestore put-key \
            --kvs-arn "$KVS_ARN" \
            --key "''${{ inputs.branch }}" \
            --value 1 \
            --if-match "$ETAG"
        '';
      }

      {
        name = "Resolve CloudFront distribution";
        id = "cf";
        run = ''
          DIST_ID=$(aws cloudfront list-distributions \
            --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, ${q}''${{ inputs.cloudfront_alias }}')] | [0].Id" \
            --output text)
          test -n "$DIST_ID" && test "$DIST_ID" != "None" || { echo "no distribution for ''${{ inputs.cloudfront_alias }}"; exit 1; }
          echo "dist_id=$DIST_ID" >> "$GITHUB_OUTPUT"
        '';
      }

      {
        name = "Invalidate CloudFront";
        run = ''
          INVALIDATION_ID=$(aws cloudfront create-invalidation \
            --distribution-id "''${{ steps.cf.outputs.dist_id }}" \
            --paths "''${{ steps.target.outputs.invalidation }}" "/versions.json" \
            --query 'Invalidation.Id' \
            --output text)
          aws cloudfront wait invalidation-completed \
            --distribution-id "''${{ steps.cf.outputs.dist_id }}" \
            --id "$INVALIDATION_ID"
          echo "Invalidation $INVALIDATION_ID completed."
        '';
      }

      {
        name = "Summarize";
        run = ''
          {
            echo "## Deploy complete"
            echo ""
            echo "- QNTX-Web branch: ''${{ inputs.branch }}"
            echo "- QNTX-Web rev:    $(git rev-parse HEAD)"
            echo "- Bucket:          ''${{ inputs.static_bucket }}"
            echo "- Live at:         ''${{ steps.target.outputs.url }}"
          } >> "$GITHUB_STEP_SUMMARY"
        '';
      }
    ];
  };
}
