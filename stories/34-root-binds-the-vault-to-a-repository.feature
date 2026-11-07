Feature: ROOT binds the vault to a repository

  "left click a dir: - Bind to repository md folder - gh user or orgs, click one - see repos, click one - see subdirs, click one"

  "i want single file bindings that follow that format"

  "in reality its still one story"

  "two stage, Confirm"

  "that its active, green dot,"

  Scenario: ROOT binds a folder of the vault to a file or directory of a repository
    Given I am in am
    And I open Node Connectors
    And the Obsidian row holds the node's vaults
    When I press a folder of the vault
    And I press "Bind to repository"
    And I press a GitHub user or organization, and one of its repositories
    Then I see its directories, notes and stories on its default branch
    When I press ▸ beside a directory
    Then I see what is inside it
    When I press the name of a file or directory
    Then I see the binding it would be
    When I press Confirm, and Confirm again
    Then what I bound is a row in the vault's tree, saying ⇄ where it comes from
    And its dot is green
