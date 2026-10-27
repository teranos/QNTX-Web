Feature: ROOT sets up OIDC for the node

  "oidc for the node"

  "a real user would do the wizard"

  "which is to accept that this is a 1,2,3,4 flow, and needs to bee seen through until the end."

  "the person should be able to be out of its mind, and QNTX should still guarantee delivered success"

  Scenario: ROOT connects the node at Anthropic with the Connect workload wizard
    Given I am ROOT
    And I am in am
    When I open Node Connectors from am
    Then Node Connectors has an Anthropic row, and its light shows whether Anthropic accepts the node
    And it also shows whether each namespace's OIDC is set up
    And the wizard's steps stand beside it, one at a time, over a scrim:
      | step             | says                             |
      | Connect workload | Open the wizard                  |
      | Issuer           | Select or register the provider  |
      | Federation rule  | Match conditions and workspaces  |
      | Target           | Pick a service account           |
      | Test             | Verify end-to-end                |
    And Node Connectors stays the same size at every step
    And Connect workload shows the link to https://platform.claude.com/settings/workload-identity-federation, with Connect workload marked
    And it says "Press Connect workload, then Custom OIDC."
    When I press Continue
    Then each step shows what to give at that screen of the wizard, each copyable, above that screen's picture:
      | step            | what to give                                                     |
      | Issuer          | Connect a new provider, with the node's issuer as its URL        |
      | Federation rule | the node's name as the rule's name, the node's DID as its sub     |
      | Target          | Create a new one, with the node's name as the service account's  |
    When the wizard's Test screen shows its snippet, I press the snippet's copy button
    And I paste the snippet into Node Connectors' Test step
    Then it shows each ID it found in it: the organization's, the rule's, the service account's and the workspace's
    And the node asks Anthropic for a token on its own identity, without my pressing anything
    And the wizard's Test connection sees the node's exchange
    And right where I pasted, I see whether Anthropic accepts the node: green, or red with what Anthropic said, copyable
    And the light is on
    When I press Done
    Then the scrim is gone, and Node Connectors shows the IDs the node keeps, and Set up again

  Scenario: What was pasted holds only part of what the node needs
    Given I am at the Test step
    When I paste the rule's ID alone
    Then it shows the rule's ID as found
    And it names the organization's, the service account's and the workspace's IDs as still needed
    And nothing is asked of Anthropic until they are there

  Scenario: Done before Anthropic accepts the node
    Given I am at the Test step
    When I press Done
    Then it says "Paste the wizard's snippet, and Anthropic accepts the node."
    And the flow stays
