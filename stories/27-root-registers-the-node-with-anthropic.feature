Feature: ROOT sets up OIDC for the node

  "oidc for the node"

  Scenario: ROOT registers the node's issuer at Anthropic
    Given I am ROOT
    And I am in am
    When I open Node Connectors from am
    Then Node Connectors has an Anthropic row, and its light shows whether Anthropic trusts the node's issuer
    And it also shows whether each namespace's OIDC is set up
    When I press the Anthropic row
    Then it shows the node's issuer, copyable
    And it shows the link to https://platform.claude.com/settings/workload-identity-federation
    And it shows the Console's Workload identity page, with Register issuer marked, img/connectors/anthropic-workload-identity.png
    And it shows what to give each field of the Register issuer form, img/connectors/anthropic-register-issuer.png:
      | field                     | what to give                  |
      | Name                      | the node's name, copyable     |
      | Issuer URL (iss claim)    | the node's issuer, copyable   |
      | JWKS source               | OIDC discovery                |
      | Discovery base URL        | blank                         |
      | CA certificate            | blank                         |
      | Enforce single-use tokens | on                            |
      | Maximum token lifetime    | 1                             |
    When I press Register
    Then the Console lists the node's issuer, img/connectors/anthropic-issuer-registered.png
    And it shows the link to https://platform.claude.com/settings/service-accounts
    And it says "Create a service account with the developer role, in the workspace that pays."
    And it shows the Console's Service accounts page, with Create service account marked, img/connectors/anthropic-service-accounts.png
    And it shows what to give each field of the Create service account form, img/connectors/anthropic-create-service-account.png:
      | field             | what to give                  |
      | Name              | the node's name, copyable     |
      | Description       | blank                         |
      | Organization role | Developer                     |
      | Workspaces        | Default                       |
    When I press Create service account
    Then the Console lists the node's service account, img/connectors/anthropic-service-account-created.png
    And it shows the link to https://platform.claude.com/settings/workload-identity-federation
    And it says "Rules, next to Issuers", img/connectors/anthropic-rules-next-to-issuers.png
    And it shows the Console's Rules tab, with New rule marked, img/connectors/anthropic-rules.png
    When I press New rule
    Then it shows what to give each field of the Create federation rule form, img/connectors/anthropic-create-rule.png, img/connectors/anthropic-create-rule-target.png:
      | field                       | what to give                  |
      | Rule name                   | the node's name, copyable     |
      | Description                 | blank                         |
      | Issuer                      | the node's issuer             |
      | Match configuration         | Pattern match                 |
      | Subject pattern             | the node's DID, copyable      |
      | Additional claim conditions | none                          |
      | Expected audience           | blank                         |
      | Service account             | the node's service account    |
      | Enable in all workspaces    | off                           |
      | Workspaces                  | Default                       |
      | OAuth scope                 | workspace:developer           |
      | Token lifetime              | 10 minutes (default)          |
    When I press Create rule
    Then the Console lists the node's rule, img/connectors/anthropic-rule-created.png
    And it shows the link to https://platform.claude.com/settings/organization, for the organization id, img/connectors/anthropic-organization.png
    When I give the organization id, the rule id and the service account id
