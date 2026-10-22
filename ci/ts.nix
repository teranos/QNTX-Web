# The TypeScript workflow. .github/workflows/ts.yml is emitted from this and is
# never edited by hand:
#   nix eval --json --file ci/ts.nix | jq . > .github/workflows/ts.yml
{
  name = "TypeScript";

  # A newer push to the same ref makes this run's answer stale.
  concurrency = {
    group = "\${{ github.workflow }}-\${{ github.ref }}";
    cancel-in-progress = true;
  };

  on = {
    pull_request = null;
    push.branches = [ "main" ];
    workflow_dispatch = null;
  };

  jobs.test = {
    name = "TypeScript Tests";
    runs-on = "ubuntu-latest";
    # The two checkouts are siblings: `bun test` walks every directory under
    # it, and a QNTX checkout inside this one once had a web/ts of its own,
    # whose tests ran here without their setup and failed (run 2026-10-21).
    defaults.run.working-directory = "web";
    steps = [
      {
        name = "Checkout repository";
        uses = "actions/checkout@v5";
        "with".path = "web";
      }

      # Three tests hold this page to QNTX's Rust, Go and migrations, and read
      # them from a checkout named QNTX_SRC. Without one they skip and say so.
      {
        name = "Checkout QNTX, for the parity tests";
        uses = "actions/checkout@v5";
        "with" = {
          repository = "teranos/QNTX";
          path = "qntx";
        };
      }

      {
        name = "Set up Bun";
        uses = "oven-sh/setup-bun@v2";
        "with".bun-version = "1.3.9";
      }

      {
        name = "Install dependencies";
        run = "bun install --frozen-lockfile";
      }

      {
        name = "Type check";
        run = "bun run typecheck";
      }

      {
        name = "Run tests";
        run = "bun test";
        env = {
          USE_JSDOM = 1;
          QNTX_SRC = "\${{ github.workspace }}/qntx";
        };
      }
    ];
  };
}
