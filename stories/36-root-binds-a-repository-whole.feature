Feature: ROOT binds a repository whole to the vault

  "we are missing some bindings like the ground CLAUDE.md, its other markdown document's"

  "so, perhaps we should introduce another vault binding, which is different from a directory or single file binding, namely;"

  "- the repository/git binding"

  "- named as one git repository under one name, like teranos/ground currently is."

  Scenario: ROOT binds a repository to the vault under one name
    Given I am in am
    And I open Node Connectors
    And the Obsidian row holds the node's vaults
    When I press "Bind a repository" on the vault
    And I press a GitHub user or organization, and one of its repositories
    Then I see the binding it would be, under the repository's own name, as teranos/ground
    When I press Confirm, and Confirm again
    Then the repository is a row in the vault's tree under that one name, saying ⇄ where it comes from
    And its CLAUDE.md, and every other markdown document of it, is a note under that name
    And its dot is green
