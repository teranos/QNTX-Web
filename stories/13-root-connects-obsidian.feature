Feature: ROOT connects Obsidian

  "for example the obsidian element, you would access it from connectors"

  "i expect to manage Node Obsidian Vault bindings from the Connectors found in am"

  Scenario: ROOT opens Obsidian from Node Connectors
    Given I am in am
    When I open Node Connectors
    Then the Obsidian row holds the node's vaults, as ADR-049 says
