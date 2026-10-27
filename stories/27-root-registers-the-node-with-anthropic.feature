Feature: ROOT sets up OIDC for the node

  "oidc for the node"

  "a real user would do the wizard"

  Scenario: ROOT connects the node at Anthropic with the Connect workload wizard
    Given I am ROOT
    And I am in am
    When I open Node Connectors from am
    Then Node Connectors has an Anthropic row, and its light shows whether Anthropic trusts the node's issuer
    And it also shows whether each namespace's OIDC is set up
    When I press the Anthropic row
    Then it shows the link to https://platform.claude.com/settings/workload-identity-federation, with Connect workload marked
    And it says "Press Connect workload, then Custom OIDC."
    And at each screen of the wizard it shows what to give there, each copyable:
      | screen          | what to give                                                     |
      | Issuer          | Connect a new provider, with the node's issuer as its URL        |
      | Federation rule | the node's name as the rule's name, the node's DID as its sub     |
      | Target          | Create a new one, with the node's name as the service account's  |
    When the wizard's Test screen shows its snippet, I press the snippet's copy button
    And I paste the snippet into Node Connectors
    Then it shows each ID it found in it: the organization's, the rule's, the service account's and the workspace's
    And the node asks Anthropic for a token on its own identity, without my pressing anything
    And the wizard's Test connection sees the node's exchange
    And right where I pasted, I see whether Anthropic accepts the node: green, or red with what Anthropic said, copyable

  Scenario: What was pasted holds only part of what the node needs
    Given I am at the node's identity
    When I paste the rule's ID alone
    Then it shows the rule's ID as found
    And it names the organization's, the service account's and the workspace's IDs as still needed
    And nothing is asked of Anthropic until they are there
