Feature: USER runs the namespace agent at Anthropic

  "oidc for each namespace each with their own rpid"
  "we will not be doing API key anymore"

  Scenario: USER registers the namespace's issuer
    Given I am standing in a namespace
    When I register the namespace's issuer at https://platform.claude.com/settings/workload-identity-federation
    And I give the namespace its rule and service account
    Then the namespace's agent runs in Anthropic's environment, off the box
    And my Anthropic organization pays for its model calls
    And no Anthropic API key is kept
